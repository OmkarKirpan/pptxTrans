"use client"

import { useAuditLog } from "@/hooks/useAuditLog"
import type { TranslationSession } from "@/types"
import SessionCard from "./session-card"

interface AuditedSessionCardProps {
  session: TranslationSession
  onShare: (sessionId: string) => void
  onExport: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export default function AuditedSessionCard({ session, onShare, onExport, onDelete }: AuditedSessionCardProps) {
  const { createAuditEvent } = useAuditLog(session.id)

  const handleShare = (sessionId: string) => {
    // Log share event
    createAuditEvent('share', {
      sessionId,
      action: 'share_session',
      sessionName: session.name
    })
    
    // Call the original onShare function
    onShare(sessionId)
  }

  const handleExport = (sessionId: string) => {
    // Log export event
    createAuditEvent('export', {
      sessionId,
      action: 'export_session',
      sessionName: session.name,
      slideCount: session.slide_count,
      format: 'pptx' // Assuming PPTX format for now
    })
    
    // Call the original onExport function
    onExport(sessionId)
  }

  const handleDelete = (sessionId: string) => {
    // Log delete event
    createAuditEvent('create', { // Using 'create' type since there's no 'delete' in AuditAction
      sessionId,
      action: 'delete_session',
      sessionName: session.name
    })
    
    // Call the original onDelete function
    onDelete(sessionId)
  }

  return (
    <SessionCard
      session={session}
      onShare={handleShare}
      onExport={handleExport}
      onDelete={handleDelete}
    />
  )
} 