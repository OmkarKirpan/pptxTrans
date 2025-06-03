"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save } from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface TranslationPreferencesProps {
  user: User
}

interface TranslationSettings {
  defaultSourceLanguage: string
  defaultTargetLanguage: string
  highQualityMode: boolean
  autoSave: boolean
}

// Common languages for the MVP
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
]

export default function TranslationPreferences({ user }: TranslationPreferencesProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<TranslationSettings>({
    defaultSourceLanguage: user.user_metadata?.default_source_language ?? "en",
    defaultTargetLanguage: user.user_metadata?.default_target_language ?? "es",
    highQualityMode: user.user_metadata?.high_quality_mode ?? true,
    autoSave: user.user_metadata?.auto_save ?? true,
  })
  const { toast } = useToast()
  const supabase = createClient()

  const handleSettingChange = (key: keyof TranslationSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const saveSettings = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          default_source_language: settings.defaultSourceLanguage,
          default_target_language: settings.defaultTargetLanguage,
          high_quality_mode: settings.highQualityMode,
          auto_save: settings.autoSave,
        },
      })

      if (error) {
        throw error
      }

      toast({
        title: "Translation preferences saved",
        description: "Your translation preferences have been updated.",
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
    settings.defaultSourceLanguage !== (user.user_metadata?.default_source_language ?? "en") ||
    settings.defaultTargetLanguage !== (user.user_metadata?.default_target_language ?? "es") ||
    settings.highQualityMode !== (user.user_metadata?.high_quality_mode ?? true) ||
    settings.autoSave !== (user.user_metadata?.auto_save ?? true)

  return (
    <div className="space-y-6">
      {/* Language Selection */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="source-language">Default Source Language</Label>
            <Select
              value={settings.defaultSourceLanguage}
              onValueChange={(value) => handleSettingChange("defaultSourceLanguage", value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The language your documents are typically in
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-language">Default Target Language</Label>
            <Select
              value={settings.defaultTargetLanguage}
              onValueChange={(value) => handleSettingChange("defaultTargetLanguage", value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The language you typically translate to
            </p>
          </div>
        </div>
      </div>

      {/* Quality and Behavior Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="high-quality" className="text-sm font-medium">
              High Quality Translation Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Use enhanced translation algorithms for better accuracy (may be slower)
            </p>
          </div>
          <Switch
            id="high-quality"
            checked={settings.highQualityMode}
            onCheckedChange={(checked) => handleSettingChange("highQualityMode", checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto-save" className="text-sm font-medium">
              Auto-save Translations
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically save your translations as you work
            </p>
          </div>
          <Switch
            id="auto-save"
            checked={settings.autoSave}
            onCheckedChange={(checked) => handleSettingChange("autoSave", checked)}
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