"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import SessionCard from "@/components/dashboard/session-card"
import EmptyState from "@/components/dashboard/empty-state"
import { useSession, useTranslationSessions } from "@/lib/store"
import { Loader2, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { TranslationSession as ApiTranslationSession } from "@/types/api"

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const { clearSession } = useSession()
  
  const {
    sessions,
    paginatedSessions,
    isLoadingList,
    error,
    fetchSessions,
    deleteSession,
    clearCurrentSessionDetails
  } = useTranslationSessions()
  
  useEffect(() => {
    async function checkAuthAndLoadSessions() {
      try {
        clearSession()
        clearCurrentSessionDetails()
        
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          router.push("/auth/login")
          return
        }
        
        await fetchSessions()
      } catch (err) {
        console.error("Error in dashboard initialization:", err)
      }
    }
    
    checkAuthAndLoadSessions()
  }, [supabase, router, clearSession, fetchSessions, clearCurrentSessionDetails])
  
  const handleDeleteSession = async (sessionId: string) => {
    if (!sessionId) return
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error("Error deleting session:", error)
    }
  }

  if (isLoadingList) {
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
  
  const displaySessions = paginatedSessions?.items || sessions;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <DashboardHeader title="Dashboard">
        <Button asChild size="lg">
          <Link href="/dashboard/new-session">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create New Session
          </Link>
        </Button>
      </DashboardHeader>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {displaySessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displaySessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={handleDeleteSession}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
