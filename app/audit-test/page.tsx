'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AuditAction } from '@/types/audit';
import { createClient } from '@/lib/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Loader2 } from 'lucide-react';
import Link from "next/link"
import { fetchWithCors, fetchWithAuthAndCors } from '@/lib/api/api-utils';

export default function AuditTestPage() {
  const supabase = createClient();
  const [sessionId, setSessionId] = useState<string>('test-session-123');
  const [selectedAction, setSelectedAction] = useState<AuditAction>('view');
  const [details, setDetails] = useState<string>('{}');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [serviceUrl, setServiceUrl] = useState<string>('');
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [testOutput, setTestOutput] = useState<string>('');
  const [directApiTest, setDirectApiTest] = useState<boolean>(false);

  const { auditLogs, isLoading, error, totalCount, currentPage, refresh, createAuditEvent } = useAuditLog(sessionId);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      setLoading(false);

      // Get the service URL from env
      setServiceUrl(process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://localhost:4006');
    };

    checkAuth();
  }, [supabase.auth]);

  const checkHealth = async () => {
    setHealthStatus('Checking...');
    try {
      const response = await fetchWithCors(`${serviceUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(`✅ Service is running. Status: ${JSON.stringify(data)}`);
      } else {
        setHealthStatus(`❌ Service is not responding correctly. Status: ${response.status}`);
      }
    } catch (error) {
      setHealthStatus(`❌ Error connecting to service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sendTestEvent = async () => {
    try {
      const parsedDetails = JSON.parse(details);
      
      if (directApiTest) {
        // Send directly to the /api/v1/events endpoint
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        
        if (!token) {
          setTestOutput('❌ Authentication required to send events directly');
          return;
        }
        
        const response = await fetchWithAuthAndCors(`${serviceUrl}/api/v1/events`, token, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            type: selectedAction,
            details: parsedDetails
          }),
        });
        
        if (response.ok) {
          const responseData = await response.json();
          setTestOutput(`✅ Direct API call successful. Response: ${JSON.stringify(responseData)}`);
        } else {
          const errorData = await response.json();
          setTestOutput(`❌ Direct API call failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }
      } else {
        // Use the hook to send through the queue service
        createAuditEvent(selectedAction, parsedDetails);
        setTestOutput(`✅ Event queued: ${selectedAction} with details: ${details}`);
      }
    } catch (error) {
      setTestOutput(`❌ Error sending event: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="mb-6">You need to be logged in to test the audit service.</p>
        <Button asChild>
          <a href="/auth/login">Log In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Audit Service Test Tools</h1>
      <p className="text-muted-foreground mb-8">
        This section provides tools to test and verify the integration with the Audit Service.
      </p>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Integration Test</CardTitle>
            <CardDescription>
              Test the integration between the frontend and the Audit Service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This test page allows you to create and view audit events for test sessions.
              It helps verify that the frontend components are correctly integrated with the Audit Service.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/audit-test/integration" passHref>
              <Button>Go to Integration Test</Button>
            </Link>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Component Test</CardTitle>
            <CardDescription>
              Test individual components with audit logging capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This page allows you to test the audit logging functionality of specific UI components
              in isolation, such as the SessionCard, SlideCanvas, and text editor.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled>Coming Soon</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 