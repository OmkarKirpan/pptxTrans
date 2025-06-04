"use client"

import { useState, useEffect } from "react"
import { useAuditLog } from "@/hooks/useAuditLog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Info } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AuditIntegrationTestPage() {
  const [sessionId, setSessionId] = useState("test-integration")
  const [eventDetails, setEventDetails] = useState("")
  const { createAuditEvent, auditLogs, isLoading, error, totalCount, refresh } = useAuditLog(sessionId)
  const [testStatus, setTestStatus] = useState<null | "success" | "error">(null)
  const [testMessage, setTestMessage] = useState("")

  // Run tests on component mount
  useEffect(() => {
    // Wait a bit before running initial refresh
    const timer = setTimeout(() => {
      refresh()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [refresh, sessionId])

  const runCreateTest = async (type: string, details: any) => {
    setTestStatus(null)
    
    try {
      createAuditEvent(type as any, details)
      setTestStatus("success")
      setTestMessage(`Successfully created ${type} event`)
      
      // Refresh logs after a short delay to allow for async processing
      setTimeout(() => {
        refresh()
      }, 1000)
    } catch (error) {
      setTestStatus("error")
      setTestMessage(`Error creating event: ${(error as Error).message}`)
    }
  }

  const handleCreateEvent = () => {
    try {
      // Parse details as JSON if provided
      const details = eventDetails ? JSON.parse(eventDetails) : {}
      runCreateTest("create", details)
    } catch (error) {
      setTestStatus("error")
      setTestMessage(`Invalid JSON details: ${(error as Error).message}`)
    }
  }

  const runViewTest = () => runCreateTest("view", { action: "test_view" })
  const runEditTest = () => runCreateTest("edit", { action: "test_edit", previousText: "original", newText: "translated" })
  const runExportTest = () => runCreateTest("export", { action: "test_export", format: "pptx" })
  const runShareTest = () => runCreateTest("share", { action: "test_share", recipient: "test@example.com" })

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Audit Service Integration Test</h1>
      <p className="text-muted-foreground mb-8">
        Use this page to test the integration between the frontend and the Audit Service.
      </p>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              Set up test parameters for the Audit Service integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="session-id">Test Session ID</Label>
                <Input 
                  id="session-id" 
                  value={sessionId} 
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter a test session ID (e.g., test-integration)"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Using "test-" prefix activates special test mode in the Audit Service
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="predefined">
          <TabsList>
            <TabsTrigger value="predefined">Predefined Tests</TabsTrigger>
            <TabsTrigger value="custom">Custom Event</TabsTrigger>
            <TabsTrigger value="view">View Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="predefined">
            <Card>
              <CardHeader>
                <CardTitle>Predefined Test Cases</CardTitle>
                <CardDescription>
                  Run standard test cases to verify Audit Service integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={runViewTest}>
                      Test View Event
                    </Button>
                    <Button onClick={runEditTest}>
                      Test Edit Event
                    </Button>
                    <Button onClick={runExportTest}>
                      Test Export Event
                    </Button>
                    <Button onClick={runShareTest}>
                      Test Share Event
                    </Button>
                  </div>
                  
                  {testStatus && (
                    <Alert variant={testStatus === "success" ? "default" : "destructive"}>
                      {testStatus === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {testStatus === "success" ? "Success" : "Error"}
                      </AlertTitle>
                      <AlertDescription>
                        {testMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="custom">
            <Card>
              <CardHeader>
                <CardTitle>Custom Event Test</CardTitle>
                <CardDescription>
                  Create a custom event with specific details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="event-details">Event Details (JSON)</Label>
                    <textarea
                      id="event-details"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={eventDetails}
                      onChange={(e) => setEventDetails(e.target.value)}
                      placeholder='{"key": "value", "nested": {"test": true}}'
                    />
                  </div>
                  
                  <Button onClick={handleCreateEvent}>
                    Create Custom Event
                  </Button>
                  
                  {testStatus && (
                    <Alert variant={testStatus === "success" ? "default" : "destructive"}>
                      {testStatus === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {testStatus === "success" ? "Success" : "Error"}
                      </AlertTitle>
                      <AlertDescription>
                        {testMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="view">
            <Card>
              <CardHeader>
                <CardTitle>View Audit Logs</CardTitle>
                <CardDescription>
                  View audit logs for the specified test session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-4">
                  <Button onClick={() => refresh()} variant="outline">
                    Refresh Logs
                  </Button>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : error ? (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : auditLogs.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Records</AlertTitle>
                    <AlertDescription>No audit logs found for this session ID</AlertDescription>
                  </Alert>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">Found {totalCount} event(s)</p>
                    
                    <div className="space-y-4">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="border rounded-lg p-4">
                          <div className="flex justify-between mb-2">
                            <span className="font-medium">{log.type}</span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">User: {log.userId}</div>
                          <div className="bg-muted p-3 rounded-md overflow-auto">
                            <pre className="text-xs">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 