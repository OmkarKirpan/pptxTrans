"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TranslationSession as ApiTranslationSession } from "@/types/api"
// import type { SessionStatus as LegacySessionStatus } from "@/types" // Removed
import { formatDistanceToNow } from "date-fns"
import { Share2, Download, Trash2, FileText, Clock, Languages, Loader2 } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuditLog } from "@/hooks/useAuditLog"

interface SessionCardProps {
  session: ApiTranslationSession
  onShare?: (sessionId: string) => void
  onExport?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
}

// Direct mapping for status text
const statusText: Record<Exclude<ApiTranslationSession['status'], 'error'>, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
  // error: "Error", // Removed as 'error' is not a valid status in ApiTranslationSession
}

// Function to get badge variant and classes
const getStatusBadgeProps = (
  status: ApiTranslationSession["status"],
): { variant: "default" | "secondary" | "outline" | "destructive"; className?: string; text: string } => {
  switch (status) {
    case "draft":
      return { variant: "outline", text: statusText.draft }
    case "in_progress":
      return { variant: "default", text: statusText.in_progress } // Uses theme's primary color
    case "completed":
      return {
        variant: "secondary",
        className: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700",
        text: statusText.completed,
      }
    case "archived":
      return { variant: "outline", className: "text-muted-foreground border-muted-foreground/50", text: statusText.archived }
    // case "error": // Removed
    default: // Should not happen with a typed status
      const exhaustiveCheck: never = status;
      return { variant: "outline", text: "Unknown" }
  }
}

export default function SessionCard({ session, onShare, onExport, onDelete }: SessionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const supabase = createClient()
  const { createAuditEvent } = useAuditLog(session.id)
  
  const currentProgress = (
    session.status === 'completed' ? 100 :
    session.status === 'in_progress' ? 50 : // Assuming 50% for in_progress, could be more dynamic
    0 // Draft or Archived
  );
  
  const handleShare = async () => {
    setIsSharing(true)
    try {
      if (onShare) {
        onShare(session.id)
      } else {
        createAuditEvent('share', {
          action: 'share_session',
          sessionName: session.session_name
        })
        console.log("Sharing session:", session.id)
      }
    } catch (error) {
      console.error("Error sharing session:", error)
    } finally {
      setIsSharing(false)
    }
  }
  
  const handleExport = async () => {
    if (session.status !== "completed") return
    
    setIsExporting(true)
    try {
      if (onExport) {
        onExport(session.id)
      } else {
        createAuditEvent('export', {
          action: 'export_session',
          sessionName: session.session_name,
          slideCount: session.slide_count || 0
        })
        console.log("Exporting session:", session.id)
      }
    } catch (error) {
      console.error("Error exporting session:", error)
    } finally {
      setIsExporting(false)
    }
  }
  
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      if (onDelete) {
        onDelete(session.id)
      } else {
        // TODO: Consider adding a more specific 'delete' AuditActionType in types/audit.ts
        createAuditEvent('edit', { // Using 'edit' as a generic modification action for deletion
          action: 'delete_session',
          sessionName: session.session_name,
          deletedSessionId: session.id // Adding more context for the 'edit' action
        })
        const { error } = await supabase
          .from('translation_sessions')
          .delete()
          .eq('id', session.id)
        if (error) throw error
      }
    } catch (error) {
      console.error("Error deleting session:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const badgeProps = getStatusBadgeProps(session.status);

  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-lg transition-shadow hover:shadow-xl dark:border-slate-700">
      <CardHeader className="p-0">
        <div className="relative aspect-[16/9] w-full bg-muted">
          <Image
            src={
              `/placeholder.svg?width=400&height=225&text=${encodeURIComponent(session.session_name || "Presentation")}`
            }
            alt={`Thumbnail for ${session.session_name}`}
            layout="fill"
            objectFit="cover"
            className="transition-transform group-hover:scale-105"
          />
          <Badge variant={badgeProps.variant} className={`absolute right-2 top-2 ${badgeProps.className || ''}`}>
            {badgeProps.text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <CardTitle className="mb-1 text-lg leading-tight hover:text-primary">
          <Link href={`/editor/${session.id}`}>{session.session_name}</Link>
        </CardTitle>
        <CardDescription className="mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>Created {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            <span>{session.slide_count || 0} slides</span>
          </div>
          {session.source_language_code && session.target_language_codes && session.target_language_codes.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <Languages className="h-3 w-3" />
              <span>
                {session.source_language_code} to {session.target_language_codes.join(', ')}
              </span>
            </div>
          )}
        </CardDescription>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{currentProgress}%</span>
          </div>
          <Progress value={currentProgress} aria-label={`${currentProgress}% translated`} className="h-2" />
        </div>
      </CardContent>
      <CardFooter className="border-t p-3">
        <TooltipProvider delayDuration={100}>
          <div className="flex w-full justify-end space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleShare} 
                  aria-label="Share session"
                  disabled={isSharing}
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleExport} 
                  aria-label="Export session" 
                  disabled={session.status !== 'completed' || isExporting}
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleDelete} 
                  aria-label="Delete session"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </CardFooter>
    </Card>
  )
}
