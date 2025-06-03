"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save } from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface NotificationSettingsProps {
  user: User
}

interface NotificationSettings {
  emailNotifications: boolean
  sessionUpdates: boolean
  securityAlerts: boolean
}

export default function NotificationSettings({ user }: NotificationSettingsProps) {
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
        title: "Notification settings saved",
        description: "Your notification preferences have been updated.",
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
    <div className="space-y-4">
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