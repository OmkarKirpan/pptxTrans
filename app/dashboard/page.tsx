import { createSupabaseServerClient } from "@/lib/supabase/server"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import SessionCard from "@/components/dashboard/session-card"
import AuditedSessionCard from "@/components/dashboard/audited-session-card"
import EmptyState from "@/components/dashboard/empty-state"
import type { TranslationSession, SessionStatus } from "@/types"
import { redirect } from "next/navigation" // For redirecting if not authenticated
import { createServerAuditEvent } from "@/lib/services/server-audit-logger"

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // This should ideally be handled by middleware in a full Next.js app
    // For Next.js, this server-side redirect will work.
    redirect("/auth/login")
  }

  const { data: sessionsData, error } = await supabase
    .from("translation_sessions")
    .select("*")
    .eq("user_id", user.id) // Fetch only sessions for the current user
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching sessions:", error)
    // Handle error display appropriately
    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader user={user} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="text-destructive">Error loading sessions: {error.message}</div>
        </main>
      </div>
    )
  }

  // Convert database result to TranslationSession[] type
  const sessions: TranslationSession[] = (sessionsData || []).map(session => ({
    ...session,
    status: session.status as SessionStatus, // Type assertion for status
  }))

  // Server actions with audit logging
  const handleShare = async (sessionId: string) => {
    "use server"
    
    try {
      console.log("Share session:", sessionId)
      // Implement share logic
      
      // Find the session to get additional details for audit log
      const session = sessions.find(s => s.id === sessionId)
      
      // Log the share action server-side
      await createServerAuditEvent(
        sessionId,
        'share',
        {
          action: 'share_session_server',
          sessionName: session?.name || 'Unknown session',
          userId: user.id,
        }
      )
    } catch (error) {
      console.error("Error sharing session:", error)
    }
  }
  
  const handleExport = async (sessionId: string) => {
    "use server"
    
    try {
      console.log("Export session:", sessionId)
      // Implement export logic
      
      // Find the session to get additional details for audit log
      const session = sessions.find(s => s.id === sessionId)
      
      // Log the export action server-side
      await createServerAuditEvent(
        sessionId,
        'export',
        {
          action: 'export_session_server',
          sessionName: session?.name || 'Unknown session',
          slideCount: session?.slide_count || 0,
          format: 'pptx',
          userId: user.id,
        }
      )
    } catch (error) {
      console.error("Error exporting session:", error)
    }
  }
  
  const handleDelete = async (sessionId: string) => {
    "use server"
    
    try {
      console.log("Delete session:", sessionId)
      // Implement delete logic, e.g., call Supabase to delete
      
      // Find the session to get additional details for audit log
      const session = sessions.find(s => s.id === sessionId)
      
      // Log the delete action server-side
      await createServerAuditEvent(
        sessionId,
        'create', // Using 'create' type since there's no 'delete' in AuditAction
        {
          action: 'delete_session_server',
          sessionName: session?.name || 'Unknown session',
          userId: user.id,
        }
      )
    } catch (error) {
      console.error("Error deleting session:", error)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <DashboardHeader user={user} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sessions.map((session) => (
              <AuditedSessionCard
                key={session.id}
                session={session}
                onShare={handleShare}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
