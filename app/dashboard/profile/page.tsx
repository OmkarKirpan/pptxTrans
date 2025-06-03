import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import ProfileForm from "@/components/dashboard/profile-form"
import PasswordChangeForm from "@/components/dashboard/password-change-form"
import AccountSettings from "@/components/dashboard/account-settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { User, Settings, Lock, Cog } from "lucide-react"
import Link from "next/link"

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const getInitials = (email?: string) => {
    if (!email) return "?"
    const parts = email.split("@")[0].split(/[._-]/)
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User"

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <DashboardHeader user={user} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Breadcrumb Navigation */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Profile</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          {/* Profile Sections */}
          <div className="grid gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and display preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileForm user={user} />
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordChangeForm />
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Account Settings
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/settings">
                      <Cog className="mr-2 h-4 w-4" />
                      App Settings
                    </Link>
                  </Button>
                </CardTitle>
                <CardDescription>
                  View your account information and manage your privacy settings. For application preferences, translation settings, and notifications, visit the Settings page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountSettings user={user} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
} 