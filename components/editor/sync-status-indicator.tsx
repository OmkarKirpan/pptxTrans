"use client"

import { useSlides } from "@/lib/store"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function SyncStatusIndicator() {
  const { syncStatus } = useSlides()
  const [showSynced, setShowSynced] = useState(false)
  
  // Show the "Synced" indicator for 3 seconds after a successful sync
  useEffect(() => {
    if (syncStatus.lastSynced && !syncStatus.isSyncing && !syncStatus.error) {
      setShowSynced(true)
      const timer = setTimeout(() => {
        setShowSynced(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [syncStatus.lastSynced, syncStatus.isSyncing, syncStatus.error])
  
  if (syncStatus.isSyncing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Syncing...</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Synchronizing changes with server</p>
        </TooltipContent>
      </Tooltip>
    )
  }
  
  if (syncStatus.error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Sync failed</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Error: {syncStatus.error}</p>
          <p className="text-xs mt-1">Your changes are saved locally but not on the server.</p>
        </TooltipContent>
      </Tooltip>
    )
  }
  
  if (showSynced) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1 text-xs text-green-600 dark:text-green-500 transition-opacity",
            "opacity-100"
          )}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Synced</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>All changes saved to server</p>
          <p className="text-xs mt-1">
            Last sync: {syncStatus.lastSynced 
              ? new Date(syncStatus.lastSynced).toLocaleTimeString() 
              : 'Unknown'
            }
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }
  
  return null
} 