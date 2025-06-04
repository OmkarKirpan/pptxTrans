'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { AuditServiceClient } from '@/lib/api/audit-service';
import { AuditQueueService } from '@/lib/services/audit-queue';
import { AuditAction, AuditEntry, AuditResponse } from '@/types/audit';
import { createClient } from '@/lib/supabase/client';

export function useAuditLog(sessionId: string) {
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const pageSize = 50;

  // Initialize queue and token
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get user session token
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token || null;
        setToken(accessToken);

        if (accessToken && sessionId) {
          // Initialize audit queue for this session
          const queueService = AuditQueueService.getInstance();
          queueService.initializeForSession(sessionId);
        }
      } catch (err) {
        console.error('Failed to initialize audit log:', err);
        setError('Failed to initialize audit logging');
      }
    };

    initialize();
  }, [sessionId, supabase.auth]);

  // Load audit logs
  const loadAuditLogs = useCallback(async (page: number = 1) => {
    if (!token || !sessionId) {
      setError('Authentication required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const auditClient = new AuditServiceClient(token);
      const response: AuditResponse = await auditClient.getSessionHistory(
        sessionId,
        page,
        pageSize
      );
      
      setAuditLogs(response.items);
      setTotalCount(response.totalCount);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Failed to load audit history');
      toast({
        title: 'Error',
        description: 'Failed to load audit logs. You can continue working.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, token, toast]);

  // Create audit event
  const createAuditEvent = useCallback((
    type: AuditAction,
    details?: any
  ) => {
    if (!token || !sessionId) {
      console.error('Cannot create audit event: Missing token or sessionId');
      return;
    }

    try {
      const queueService = AuditQueueService.getInstance();
      queueService.enqueueEvent(
        {
          sessionId,
          type,
          details,
        },
        token
      );
    } catch (err) {
      console.error('Failed to create audit event:', err);
      // We don't show UI errors for audit event creation failures
      // as specified in the requirements (fail gracefully)
    }
  }, [sessionId, token]);

  // Handle pagination
  const goToPage = useCallback((page: number) => {
    loadAuditLogs(page);
  }, [loadAuditLogs]);

  return {
    auditLogs,
    isLoading,
    error,
    totalCount,
    currentPage,
    pageSize,
    goToPage,
    createAuditEvent,
    refresh: () => loadAuditLogs(currentPage),
  };
} 