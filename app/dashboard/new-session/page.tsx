"use client"

import UploadWizard from "@/components/dashboard/upload-wizard"
import DashboardHeader from "@/components/dashboard/dashboard-header" // Re-using existing header
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react" // Declaring Loader2 variable

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
  }, [supabase, router])

  const handleSessionComplete = (sessionId: string, sessionName: string) => {
    console.log(`Session ${sessionName} (ID: ${sessionId}) created/configured. Navigating to editor...`)
    // Actual navigation happens in UploadWizard for this example
    // router.push(`/editor/${sessionId}`);
  }

  if (loadingUser || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <DashboardHeader user={user} />
      <main className="flex flex-1 flex-col items-center justify-start p-4 pt-10 sm:p-6 lg:p-8">
        <UploadWizard onComplete={handleSessionComplete} supportedLanguages={MOCK_LANGUAGES} userId={user.id} />
      </main>
    </div>
  )
}
