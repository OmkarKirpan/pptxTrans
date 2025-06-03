"use client"

import { useState } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Calendar, Mail, Shield, UserCheck } from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface AccountSettingsProps {
  user: User
}

interface NotificationSettings {
  emailNotifications: boolean
  sessionUpdates: boolean
  securityAlerts: boolean
}

export default function AccountSettings({ user }: AccountSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: user.user_metadata?.email_notifications ?? true,
    sessionUpdates: user.user_metadata?.session_updates ?? true,
    securityAlerts: user.user_metadata?.security_alerts ?? true,
  })
  const { toast } = useToast()
  const supabase = createClient()

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const saveSettings = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          email_notifications: settings.emailNotifications,
          session_updates: settings.sessionUpdates,
          security_alerts: settings.securityAlerts,
        },
      })

      if (error) {
        throw error
      }

      toast({
        title: "Settings saved successfully",
        description: "Your account preferences have been updated.",
      })
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = 
    settings.emailNotifications !== (user.user_metadata?.email_notifications ?? true) ||
    settings.sessionUpdates !== (user.user_metadata?.session_updates ?? true) ||
    settings.securityAlerts !== (user.user_metadata?.security_alerts ?? true)

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Account Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Account Created</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(user.created_at), "PPP")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Last Sign In</p>
              <p className="text-sm text-muted-foreground">
                {user.last_sign_in_at 
                  ? format(new Date(user.last_sign_in_at), "PPp")
                  : "Never"
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Email Verification Status</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
                {user.email_confirmed_at ? "Verified" : "Unverified"}
              </Badge>
              {user.email_confirmed_at && (
                <span className="text-xs text-muted-foreground">
                  Verified on {format(new Date(user.email_confirmed_at), "PP")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notification Preferences */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h3 className="text-lg font-medium">Notification Preferences</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-sm font-medium">
                Email Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive general email notifications about your account
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleSettingChange("emailNotifications", checked)}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="session-updates" className="text-sm font-medium">
                Translation Session Updates
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when your translation sessions are processed or completed
              </p>
            </div>
            <Switch
              id="session-updates"
              checked={settings.sessionUpdates}
              onCheckedChange={(checked) => handleSettingChange("sessionUpdates", checked)}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="security-alerts" className="text-sm font-medium">
                Security Alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive important security notifications about your account
              </p>
            </div>
            <Switch
              id="security-alerts"
              checked={settings.securityAlerts}
              onCheckedChange={(checked) => handleSettingChange("securityAlerts", checked)}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Avatar Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Avatar & Display</h3>
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Automatic Avatar Generation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your avatar is automatically generated based on your name or email address. 
                This ensures consistency across the platform while maintaining your privacy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={saveSettings} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
} 