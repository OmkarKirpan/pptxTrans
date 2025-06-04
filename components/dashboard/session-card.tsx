"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TranslationSession } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { Share2, Download, Trash2, FileText, Clock, Languages, Loader2 } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { useSession } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { useAuditLog } from "@/hooks/useAuditLog"

interface SessionCardProps {
  session: TranslationSession
  onShare?: (sessionId: string) => void
  onExport?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
}

export default function SessionCard({ session, onShare, onExport, onDelete }: SessionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const supabase = createClient()
  const { createAuditEvent } = useAuditLog(session.id)
  
  // Use the session store
  const { setSession, clearSession } = useSession()

  const getStatusVariant = (
    status: TranslationSession["status"],
  ): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "draft":
        return "secondary"
      case "in-progress":
        return "default" // Using primary color via default Badge style
      case "ready":
        return "destructive" // Changed from "success" to match available variants
      default:
        return "outline"
    }
  }

  const statusText = {
    draft: "Draft",
    "in-progress": "In Progress",
    ready: "Ready for Export",
  }
  
  const handleShare = async () => {
    setIsSharing(true)
    
    try {
      // Call the parent component's onShare handler if provided
      if (onShare) {
        onShare(session.id)
      } else {
        // Handle sharing logic directly
        createAuditEvent('share', {
          action: 'share_session',
          sessionName: session.name
        })
        
        // Implement share functionality - for now just a placeholder
        console.log("Sharing session:", session.id)
      }
    } catch (error) {
      console.error("Error sharing session:", error)
    } finally {
      setIsSharing(false)
    }
  }
  
  const handleExport = async () => {
    if (session.status !== "ready") return
    
    setIsExporting(true)
    
    try {
      // Call the parent component's onExport handler if provided
      if (onExport) {
        onExport(session.id)
      } else {
        // Handle export logic directly
        createAuditEvent('export', {
          action: 'export_session',
          sessionName: session.name,
          slideCount: session.slide_count
        })
        
        // Implement export functionality - for now just a placeholder
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
      // Optimistically update UI by removing the session from the store
      clearSession()
      
      // Call the parent component's onDelete handler if provided
      if (onDelete) {
        onDelete(session.id)
      } else {
        // Handle delete logic directly
        createAuditEvent('create', {
          action: 'delete_session',
          sessionName: session.name
        })
        
        // Delete the session from Supabase
        const { error } = await supabase
          .from('translation_sessions')
          .delete()
          .eq('id', session.id)
        
        if (error) throw error
      }
    } catch (error) {
      console.error("Error deleting session:", error)
      
      // If there was an error, restore the session in the store
      setSession(session, 'owner')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-lg transition-shadow hover:shadow-xl">
      <CardHeader className="p-0">
        <div className="relative aspect-[16/9] w-full bg-muted">
          <Image
            src={
              session.thumbnail_url || `/placeholder.svg?width=400&height=225&query=presentation+slide+${session.name}`
            }
            alt={`Thumbnail for ${session.name}`}
            layout="fill"
            objectFit="cover"
            className="transition-transform group-hover:scale-105"
          />
          <Badge variant={getStatusVariant(session.status)} className="absolute right-2 top-2">
            {statusText[session.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <CardTitle className="mb-1 text-lg leading-tight hover:text-primary">
          <Link href={`/editor/${session.id}`}>{session.name}</Link>
        </CardTitle>
        <CardDescription className="mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>Created {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            <span>{session.slide_count} slides</span>
          </div>
          {session.source_language && session.target_language && (
            <div className="mt-1 flex items-center gap-1.5">
              <Languages className="h-3 w-3" />
              <span>
                {session.source_language} to {session.target_language}
              </span>
            </div>
          )}
        </CardDescription>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{session.progress}%</span>
          </div>
          <Progress value={session.progress} aria-label={`${session.progress}% translated`} className="h-2" />
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
                  {isSharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
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
                  disabled={session.status !== "ready" || isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
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
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete session"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
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
