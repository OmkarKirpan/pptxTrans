"use client"

import { useState, useEffect, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Presentation, Mail, ArrowLeft } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Redirect logged-in users to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push("/dashboard")
      }
    }
    checkAuth()
  }, [router, supabase.auth])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (resetError) {
      console.error("Password reset request failed:", resetError.message)
      // Use generic error message for security
      setError("An error occurred while processing your request. Please try again.")
    } else {
      // Generic success message (don't reveal if email exists)
      setMessage("If an account with that email exists, you will receive a password reset link shortly. Please check your email and spam folder.")
      setEmail("")
      
      // Redirect to login after 5 seconds
      setTimeout(() => {
        router.push("/auth/login")
      }, 5000)
    }
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex items-center justify-center space-x-2">
            <Presentation className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold">Reset Password</CardTitle>
          </div>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            {message && (
              <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded-md">
                {message}
                <p className="mt-2 text-xs text-muted-foreground">
                  Redirecting to login page in a few seconds...
                </p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <Link
            href="/auth/login"
            className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Login</span>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
} 