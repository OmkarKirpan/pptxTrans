"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TranslationSession } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { Share2, Download, Trash2, FileText, Clock, Languages } from "lucide-react"
import Image from "next/image"

interface SessionCardProps {
  session: TranslationSession
  onShare: (sessionId: string) => void
  onExport: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export default function SessionCard({ session, onShare, onExport, onDelete }: SessionCardProps) {
  const getStatusVariant = (
    status: TranslationSession["status"],
  ): "default" | "secondary" | "outline" | "destructive" | "success" | "warning" => {
    switch (status) {
      case "draft":
        return "secondary"
      case "in-progress":
        return "default" // Using primary color via default Badge style
      case "ready":
        return "success"
      default:
        return "outline"
    }
  }

  const statusText = {
    draft: "Draft",
    "in-progress": "In Progress",
    ready: "Ready for Export",
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
                <Button variant="ghost" size="icon" onClick={() => onShare(session.id)} aria-label="Share session">
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onExport(session.id)}
                  aria-label="Export session"
                  disabled={session.status !== "ready"}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(session.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete session"
                >
                  <Trash2 className="h-4 w-4" />
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
