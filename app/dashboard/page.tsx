import { createSupabaseServerClient } from "@/lib/supabase/server"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import SessionCard from "@/components/dashboard/session-card"
import EmptyState from "@/components/dashboard/empty-state"
import type { TranslationSession } from "@/types"
import { redirect } from "next/navigation" // For redirecting if not authenticated

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

  const sessions: TranslationSession[] = sessionsData || []

  // Mock functions for SessionCard actions
  const handleShare = async (sessionId: string) => {
    "use server"
    console.log("Share session:", sessionId)
    // Implement share logic
  }
  const handleExport = async (sessionId: string) => {
    "use server"
    console.log("Export session:", sessionId)
    // Implement export logic
  }
  const handleDelete = async (sessionId: string) => {
    "use server"
    console.log("Delete session:", sessionId)
    // Implement delete logic, e.g., call Supabase to delete
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
              <SessionCard
                key={session.id}
                session={session}
                // @ts-expect-error Server Action type mismatch for client component prop
                onShare={handleShare}
                // @ts-expect-error Server Action type mismatch for client component prop
                onExport={handleExport}
                // @ts-expect-error Server Action type mismatch for client component prop
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
