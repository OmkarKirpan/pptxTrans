"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Moon, Sun, Monitor } from "lucide-react"

export function ThemeDemo() {
  const { theme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div>Loading theme...</div>
  }

  const currentTheme = theme === "system" ? systemTheme : theme
  const ThemeIcon = currentTheme === "dark" ? Moon : currentTheme === "light" ? Sun : Monitor

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThemeIcon className="h-5 w-5" />
          Theme Status
        </CardTitle>
        <CardDescription>Current theme configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Selected Theme:</span>
          <Badge variant="outline">{theme}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">System Theme:</span>
          <Badge variant="outline">{systemTheme}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Active Theme:</span>
          <Badge variant={currentTheme === "dark" ? "secondary" : "default"}>
            {currentTheme}
          </Badge>
        </div>
        <div className="mt-4 p-3 rounded border">
          <p className="text-xs text-muted-foreground">
            This card should change appearance when you switch themes using the toggle button or the settings page.
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 