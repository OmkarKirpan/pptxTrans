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
      const response = await fetch(`${serviceUrl}/health`);
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
        
        const response = await fetch(`${serviceUrl}/api/v1/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
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
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Audit Service Test</h1>
      
      <Tabs defaultValue="send">
        <TabsList className="mb-6">
          <TabsTrigger value="send">Send Events</TabsTrigger>
          <TabsTrigger value="view">View Events</TabsTrigger>
          <TabsTrigger value="health">Service Health</TabsTrigger>
        </TabsList>
        
        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Audit Event</CardTitle>
              <CardDescription>
                Send test events to the audit service to verify the integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-id">Session ID</Label>
                <Input 
                  id="session-id" 
                  value={sessionId} 
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter a session ID"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="action-type">Event Type</Label>
                <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value as AuditAction)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="merge">Merge</SelectItem>
                    <SelectItem value="comment">Comment</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                    <SelectItem value="share">Share</SelectItem>
                    <SelectItem value="unshare">Unshare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="event-details">Event Details (JSON)</Label>
                <Textarea 
                  id="event-details" 
                  value={details} 
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder='{"slideId": "slide-1", "textId": "text-1", "before": "Hello", "after": "Hello World"}'
                  rows={5}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="direct-api"
                  checked={directApiTest}
                  onChange={(e) => setDirectApiTest(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="direct-api" className="text-sm font-normal">
                  Test direct API call to /api/v1/events endpoint
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex-col items-start space-y-4">
              <Button onClick={sendTestEvent}>Send Test Event</Button>
              
              {testOutput && (
                <div className="w-full p-4 border rounded-md bg-muted text-sm">
                  <p className="font-mono">{testOutput}</p>
                </div>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="view">
          <Card>
            <CardHeader>
              <CardTitle>View Audit Events</CardTitle>
              <CardDescription>
                View audit events for the specified session ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="view-session-id">Session ID</Label>
                  <Input 
                    id="view-session-id" 
                    value={sessionId} 
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter a session ID"
                  />
                </div>
                <Button className="self-end" onClick={() => refresh()}>
                  Refresh
                </Button>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : error ? (
                <div className="p-4 border border-destructive rounded-md text-destructive">
                  Error: {error}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-4 border rounded-md text-center text-muted-foreground">
                  No audit logs found for this session ID
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Found {totalCount} events, showing page {currentPage}</p>
                  
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 border rounded-md">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">{log.action}</span>
                        <span className="text-sm text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded-md overflow-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>Audit Service Health</CardTitle>
              <CardDescription>
                Check if the audit service is running and accessible
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-url">Service URL</Label>
                <Input 
                  id="service-url" 
                  value={serviceUrl} 
                  onChange={(e) => setServiceUrl(e.target.value)}
                  placeholder="http://localhost:4006"
                />
              </div>
              
              <Button onClick={checkHealth}>Check Health</Button>
              
              {healthStatus && (
                <div className="p-4 border rounded-md bg-muted mt-4">
                  <p>{healthStatus}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 