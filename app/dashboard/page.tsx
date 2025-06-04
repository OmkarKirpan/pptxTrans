"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import SessionCard from "@/components/dashboard/session-card"
import EmptyState from "@/components/dashboard/empty-state"
import type { TranslationSession, SessionStatus } from "@/types"
import { useSession } from "@/lib/store"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [sessions, setSessions] = useState<TranslationSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { clearSession } = useSession()

  useEffect(() => {
    async function fetchSessions() {
      setLoading(true)
      
      try {
        // Clear any active session when visiting dashboard
        clearSession()
        
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          router.push("/auth/login")
          return
        }
        
        // Fetch sessions for the current user
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("translation_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          
        if (sessionsError) {
          throw sessionsError
        }
        
        // Convert to properly typed TranslationSession[]
        const typedSessions: TranslationSession[] = (sessionsData || []).map(session => ({
          ...session,
          status: session.status as SessionStatus,
        }))
        
        setSessions(typedSessions)
      } catch (err) {
        console.error("Error fetching sessions:", err)
        setError(err instanceof Error ? err.message : "Failed to load sessions")
      } finally {
        setLoading(false)
      }
    }
    
    fetchSessions()
  }, [supabase, router, clearSession])
  
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader title="Dashboard" />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading your translation sessions...</p>
          </div>
        </main>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader title="Dashboard" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="text-destructive">Error loading sessions: {error}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <DashboardHeader title="Dashboard" />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
