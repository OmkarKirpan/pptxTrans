import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import TranslationPreferences from "@/components/dashboard/translation-preferences"
import NotificationSettings from "@/components/dashboard/notification-settings"
import ApplicationPreferences from "@/components/dashboard/application-preferences"
import { ThemeDemo } from "@/components/theme-demo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Settings, Bell, Globe, Palette } from "lucide-react"

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

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
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Header */}
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/20 p-3">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground">Manage your application preferences and settings</p>
            </div>
          </div>

          <Separator />

          {/* Theme Demo - for testing */}
          <div className="flex justify-center">
            <ThemeDemo />
          </div>

          {/* Settings Sections */}
          <div className="grid gap-6">
            {/* Translation Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Translation Preferences
                </CardTitle>
                <CardDescription>
                  Set your default languages and translation quality preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TranslationPreferences user={user} />
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Configure how and when you want to be notified.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationSettings user={user} />
              </CardContent>
            </Card>

            {/* Application Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Application Preferences
                </CardTitle>
                <CardDescription>
                  Customize your application experience and interface.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApplicationPreferences user={user} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
} 