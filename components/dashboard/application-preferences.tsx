"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save } from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface ApplicationPreferencesProps {
  user: User
}

interface ApplicationSettings {
  theme: string
  language: string
  compactMode: boolean
  showTooltips: boolean
  enableAnimations: boolean
}

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

const INTERFACE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
]

export default function ApplicationPreferences({ user }: ApplicationPreferencesProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<ApplicationSettings>({
    theme: user.user_metadata?.app_theme ?? "system",
    language: user.user_metadata?.app_language ?? "en",
    compactMode: user.user_metadata?.compact_mode ?? false,
    showTooltips: user.user_metadata?.show_tooltips ?? true,
    enableAnimations: user.user_metadata?.enable_animations ?? true,
  })
  const { toast } = useToast()
  const supabase = createClient()

  // Sync theme with next-themes on mount
  useEffect(() => {
    setMounted(true)
    if (user.user_metadata?.app_theme && theme !== user.user_metadata.app_theme) {
      setTheme(user.user_metadata.app_theme)
    }
  }, [user.user_metadata?.app_theme, theme, setTheme])

  const handleSettingChange = (key: keyof ApplicationSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    
    // Immediately apply theme changes
    if (key === "theme" && typeof value === "string") {
      setTheme(value)
    }
  }

  const saveSettings = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          app_theme: settings.theme,
          app_language: settings.language,
          compact_mode: settings.compactMode,
          show_tooltips: settings.showTooltips,
          enable_animations: settings.enableAnimations,
        },
      })

      if (error) {
        throw error
      }

      toast({
        title: "Application preferences saved",
        description: "Your interface preferences have been updated.",
      })
    } catch (error: any) {
      toast({
        title: "Error saving preferences",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = 
    settings.theme !== (user.user_metadata?.app_theme ?? "system") ||
    settings.language !== (user.user_metadata?.app_language ?? "en") ||
    settings.compactMode !== (user.user_metadata?.compact_mode ?? false) ||
    settings.showTooltips !== (user.user_metadata?.show_tooltips ?? true) ||
    settings.enableAnimations !== (user.user_metadata?.enable_animations ?? true)

  // Prevent hydration mismatch
  if (!mounted) {
    return <div className="animate-pulse space-y-6">
      <div className="h-4 bg-muted rounded w-1/4"></div>
      <div className="h-10 bg-muted rounded"></div>
      <div className="h-4 bg-muted rounded w-1/3"></div>
      <div className="h-10 bg-muted rounded"></div>
    </div>
  }

  return (
    <div className="space-y-6">
      {/* Appearance Settings */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={theme || settings.theme}
              onValueChange={(value) => handleSettingChange("theme", value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color theme
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interface-language">Interface Language</Label>
            <Select
              value={settings.language}
              onValueChange={(value) => handleSettingChange("language", value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {INTERFACE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Language for the application interface
            </p>
          </div>
        </div>
      </div>

      {/* Interface Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="compact-mode" className="text-sm font-medium">
              Compact Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Use a more compact interface with less spacing
            </p>
          </div>
          <Switch
            id="compact-mode"
            checked={settings.compactMode}
            onCheckedChange={(checked) => handleSettingChange("compactMode", checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="show-tooltips" className="text-sm font-medium">
              Show Tooltips
            </Label>
            <p className="text-xs text-muted-foreground">
              Display helpful tooltips when hovering over elements
            </p>
          </div>
          <Switch
            id="show-tooltips"
            checked={settings.showTooltips}
            onCheckedChange={(checked) => handleSettingChange("showTooltips", checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="enable-animations" className="text-sm font-medium">
              Enable Animations
            </Label>
            <p className="text-xs text-muted-foreground">
              Enable smooth animations and transitions throughout the app
            </p>
          </div>
          <Switch
            id="enable-animations"
            checked={settings.enableAnimations}
            onCheckedChange={(checked) => handleSettingChange("enableAnimations", checked)}
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
                Save Preferences
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
} 