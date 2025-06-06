'use server';

import { AuditAction } from '@/types/audit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:4006';

/**
 * Server-side audit logger for creating audit events directly from server actions
 */
export async function createServerAuditEvent(
  sessionId: string,
  type: AuditAction,
  details?: any
): Promise<void> {
  try {
    // Get the service role token for server-to-server communication
    const supabase = await createSupabaseServerClient();
    
    // Get service role key from environment or Supabase admin client
    // This is a placeholder - in a real implementation, you would use a proper service key
    const serviceToken = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!serviceToken) {
      console.error('Missing service token for server-side audit logging');
      return;
    }
    
    // Send the audit event directly to the audit service
    const response = await fetch(`${AUDIT_SERVICE_URL}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        type,
        details,
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create audit event: ${errorData.message || response.statusText}`);
    }
  } catch (error) {
    // Log the error but don't throw - audit logging should not break core functionality
    console.error('Server-side audit logging failed:', error);
  }
} 