"use client"

import UploadWizard from "@/components/dashboard/upload-wizard"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
// import { useSession } from "@/lib/store" // useSession() no longer provides the states used here

// Mock data for supported languages
const MOCK_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese (Simplified)" },
]

export default function NewSessionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  
  // const { currentSession, isLoading: isSessionLoading, error: sessionError } = useSession() // Removed

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        console.error("User not authenticated, redirecting to login.")
        router.push("/auth/login")
      } else {
        setUser(data.user)
      }
      setLoadingUser(false)
    }
    fetchUser()
    
    // If we already have a session in the store, redirect to the editor -- REMOVED
    // if (currentSession) { -- REMOVED
    //   router.push(`/editor/${currentSession.id}`) -- REMOVED
    // } -- REMOVED
  }, [supabase, router]) // currentSession removed from dependencies

  const handleSessionComplete = (sessionId: string, sessionName: string) => {
    console.log(`Session ${sessionName} (ID: ${sessionId}) created/configured. Navigating to editor...`)
    // Actual navigation happens in UploadWizard
  }

  if (loadingUser || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    )
  }
  
  // if (isSessionLoading) { -- REMOVED loading state from useSession()
  //   return (
  //     <div className="flex min-h-screen flex-col items-center justify-center">
  //       <Loader2 className="h-12 w-12 animate-spin text-primary" />
  //       <p className="mt-4 text-muted-foreground">Creating session...</p>
  //     </div>
  //   )
  // }
  
  // if (sessionError) { -- REMOVED error state from useSession()
  //   return (
  //     <div className="flex min-h-screen flex-col">
  //       <DashboardHeader title="New Session" showBackButton />
  //       <main className="flex flex-1 flex-col items-center justify-start p-4 pt-10 sm:p-6 lg:p-8">
  //         <div className="text-destructive mb-4">Error: {sessionError}</div>
  //         <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
  //       </main>
  //     </div>
  //   )
  // }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <DashboardHeader title="New Session" showBackButton />
      <main className="flex flex-1 flex-col items-center justify-start p-4 pt-10 sm:p-6 lg:p-8">
        <UploadWizard onComplete={handleSessionComplete} supportedLanguages={MOCK_LANGUAGES} userId={user.id} />
      </main>
    </div>
  )
}
