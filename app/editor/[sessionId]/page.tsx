"use client" // For client-side interactions and state hooks

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { Loader2, AlertTriangle, Eye, MessageSquare, MessageSquareOff, Lock } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuditLog } from "@/hooks/useAuditLog"
import { SyncStatusIndicator } from "@/components/editor/sync-status-indicator"
import { useRealTimeSync } from "@/lib/services/realtime-sync"
import { updateLastOpenedAt } from "@/lib/api/translationSessionApi"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import SlideNavigator from "@/components/editor/slide-navigator"
import SlideCanvas from "@/components/editor/slide-canvas"
import CommentsPanel from "@/components/editor/comments-panel"
import { createClient } from "@/lib/supabase/client"

// Import Zustand hooks
import { useSlides, useEditBuffers, useTranslationSessions, useSession } from "@/lib/store"
import { PptxProcessorClient } from '@/lib/api/pptx-processor'

// MOCK DATA using ProcessedSlide and new SlideShape structure - REMOVE THIS
// const MOCK_PROCESSED_SLIDES: ProcessedSlide[] = [ ... ];

export default function SlideEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { subscribeToSession, unsubscribeFromSession } = useRealTimeSync()
  const { toast } = useToast()

  const sessionId = params.sessionId as string
  
  const { createAuditEvent } = useAuditLog(sessionId)

  // Get user role and share token information
  const { userRole, shareToken } = useSession()
  const isSharedAccess = !!shareToken
  const canEdit = userRole === 'owner' // Only owners can edit (for now)
  const canComment = userRole === 'owner' || userRole === 'reviewer' // Owners and reviewers can comment

  // Use TranslationSessions store for session metadata
  const { 
    currentSessionDetails, // Renamed from sessionData for clarity
    fetchSessionDetails, 
    isLoadingDetails: isSessionDetailsLoading, // Use this for loading state
    error: translationSessionError, // Use this for error state
    clearCurrentSessionDetails,
    markSessionInProgress, // Added new action
    markSessionCompleted // Added new action
  } = useTranslationSessions()
  
  // Use Slides store for slide data
  const {
    slides,
    currentSlideId,
    setCurrentSlide,
    slidesLoading,
    slidesError,
    updateShape,
    fetchSlidesForSession
  } = useSlides()
  
  const {
    activeBufferId,
    createBuffer,
    updateBuffer,
    saveBuffer,
    setActiveBuffer,
    activeBuffer
  } = useEditBuffers()

  const [user, setUser] = useState<User | null>(null) // Keep for user auth state
  const [isExporting, setIsExporting] = useState(false)

  // Derived current slide
  const currentSlide = slides.find(s => s.id === currentSlideId)

  useEffect(() => {
    const fetchData = async () => {
      // For shared access, we don't need to check user authentication
      if (!isSharedAccess) {
        const supabase = createClient(); // Create client locally for auth check
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !authUser) {
          router.push("/auth/login")
          return
        }
        setUser(authUser)
      }

      try {
        // Only update last opened for owner (not for shared access)
        if (!isSharedAccess) {
          await updateLastOpenedAt(sessionId)
          createAuditEvent('view', { action: 'session_opened', sessionId });
        } else {
          createAuditEvent('view', { 
            action: 'session_opened_via_share', 
            sessionId,
            userRole,
            shareAccess: true 
          });
        }
        
        // Fetch session details first
        await fetchSessionDetails(sessionId)
        
        // Fetch slides and shapes from Slides store
        await fetchSlidesForSession(sessionId)

      } catch (error: any) {
        console.error("Error fetching session or slide data:", error)
      }
    }

    if (sessionId) {
      fetchData()
    }
    
    // Cleanup when component unmounts or sessionId changes
    return () => {
      unsubscribeFromSession(sessionId)
      clearCurrentSessionDetails() // Clear session details from store
    }
  }, [sessionId, router, fetchSessionDetails, fetchSlidesForSession, createAuditEvent, unsubscribeFromSession, clearCurrentSessionDetails, isSharedAccess, userRole])

  // Effect for real-time subscription & status transition
  useEffect(() => {
    if (sessionId && currentSessionDetails && slides && slides.length > 0 && !slidesLoading && !isSessionDetailsLoading) {
      subscribeToSession(sessionId)
      createAuditEvent('view', { action: 'realtime_subscription_started', sessionId });

      // Automatically transition status from draft to in_progress (only for owner, not shared access)
      if (currentSessionDetails.status === 'draft' && !isSharedAccess && canEdit) {
        markSessionInProgress(sessionId);
        createAuditEvent('edit', { action: 'session_status_updated', sessionId, newStatus: 'in_progress' });
      }
    }
    // No explicit return for unsubscribe here, as it's handled in the main fetchData useEffect's cleanup
  }, [sessionId, currentSessionDetails, slides, slidesLoading, isSessionDetailsLoading, subscribeToSession, createAuditEvent, markSessionInProgress, isSharedAccess, canEdit])


  // Loading state: Check both session details and slides loading
  if (isSessionDetailsLoading || slidesLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-xl">Loading slide editor...</p>
      </div>
    )
  }

  // Error state: Check errors from both slices
  if (translationSessionError || slidesError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Session</h2>
        <p className="text-muted-foreground mb-4 text-center">
          There was an error loading the session data. Please try again later.
        </p>
        <p className="text-xs text-destructive-foreground bg-destructive/80 p-2 rounded">
          {translationSessionError || slidesError}
        </p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">
          Go to Dashboard
        </Button>
      </div>
    )
  }

  if (!currentSessionDetails) { 
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading session data...</p>
      </div>
    )
  }
  
  if (slides.length === 0 && !slidesLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Slides Found</h2>
        <p className="text-muted-foreground mb-4 text-center">
          This translation session does not have any slides processed yet, or there was an issue loading them.
        </p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">
          Go to Dashboard
        </Button>
      </div>
    )
  }


  // Ensure currentSlideId is valid, default to first slide if not
  let activeSlideId = currentSlideId
  if (!activeSlideId && slides.length > 0) {
    activeSlideId = slides[0].id
  }
  const slideToDisplay = slides.find(s => s.id === activeSlideId) || slides[0];


  const handleSaveTranslation = async () => {
    if (!canEdit) {
      // Show permission error toast or dialog
      console.error("You don't have permission to edit this session");
      return;
    }

    if (activeBufferId && activeBuffer && activeBuffer.isDirty && saveBuffer) {
      try {
        await saveBuffer(activeBufferId) 
        
        createAuditEvent('edit', { 
          action: 'text_translated', 
          slideId: activeBuffer.slideId,
          shapeId: activeBuffer.shapeId,
        });

      } catch (error) {
        console.error("Error saving translation:", error)
      }
      setActiveBuffer(null)
    }
  }

  // Ensure currentSlideId exists and is valid, if not, select the first slide
  useEffect(() => {
    if (slides.length > 0 && !slides.find(s => s.id === currentSlideId)) {
      setCurrentSlide(slides[0].id);
    }
  }, [slides, currentSlideId, setCurrentSlide]);

  // Re-implement handleExport
  const handleExport = async () => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "You don't have permission to export this session"
      });
      return;
    }

    if (!currentSessionDetails) return;
    
    try {
      setIsExporting(true);
      
      // Create audit event for export initiated
      createAuditEvent('export', {
        action: 'pptx_export_initiated',
        sessionId: currentSessionDetails.id,
        slideCount: slides.length,
      });
      
      // Start export process
      toast({
        title: "Export started",
        description: "Your presentation is being prepared for export. This may take a few minutes."
      });
      
      // Call export endpoint
      const pptxProcessorClient = new PptxProcessorClient();
      const response = await pptxProcessorClient.exportPptx(currentSessionDetails.id);
      
      // Set up polling for job status
      const jobId = response.job_id;
      const statusCheckInterval = setInterval(async () => {
        try {
          const statusResponse = await pptxProcessorClient.getProcessingStatus(jobId);
          
          if (statusResponse.status === 'completed') {
            clearInterval(statusCheckInterval);
            setIsExporting(false);
            
            // Get download URL
            const downloadUrl = await pptxProcessorClient.getExportDownloadUrl(currentSessionDetails.id);
            
            // Create audit event for export completed
            createAuditEvent('export', {
              action: 'pptx_export_completed',
              sessionId: currentSessionDetails.id,
              slideCount: slides.length,
            });
            
            // Show success notification with download link
            toast({
              title: "Export completed",
              description: "Your presentation is ready for download.",
              action: (
                <ToastAction altText="Download" onClick={() => window.open(downloadUrl, '_blank')}>
                  Download
                </ToastAction>
              ),
            });
          } else if (statusResponse.status === 'failed') {
            clearInterval(statusCheckInterval);
            setIsExporting(false);
            
            // Create audit event for export failed
            createAuditEvent('export', {
              action: 'pptx_export_failed',
              sessionId: currentSessionDetails.id,
              error: statusResponse.error || 'Unknown error',
            });
            
            toast({
              variant: "destructive",
              title: "Export failed",
              description: statusResponse.error || "Failed to export presentation"
            });
          }
        } catch (error) {
          console.error("Error checking export status:", error);
        }
      }, 5000); // Check every 5 seconds
      
    } catch (error) {
      setIsExporting(false);
      console.error("Export failed:", error);
      
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  };

  // Re-implement handleTextClick
  const handleTextClick = (
    shapeId: string,
    originalText: string,
    currentTranslation?: string,
    shapeData?: any // from SlideShape, for audit logging context
  ) => {
    if (!currentSlide) return;

    // If user can't edit, just show a read-only view of the text
    if (!canEdit) {
      // Show a message or toast that the user doesn't have edit permissions
      console.log("View-only access: Cannot edit translations");
      // Could show a read-only dialog here instead
      return;
    }

    createBuffer(shapeId, currentSlide.id, originalText, currentTranslation);

    createAuditEvent('view', {
      action: 'text_editor_opened',
      slideId: currentSlide.id,
      slideNumber: currentSlide.slide_number,
      shapeId,
      shapeDetails: shapeData,
    });
  };

  // Re-implement handleCloseDialog
  const handleCloseDialog = () => {
    if (activeBufferId) {
      setActiveBuffer(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!canEdit) {
      // Show permission error toast or dialog
      console.error("You don't have permission to mark this session as complete");
      return;
    }

    if (currentSessionDetails && currentSessionDetails.status === 'in_progress') {
      await markSessionCompleted(currentSessionDetails.id);
      createAuditEvent('edit', { action: 'session_status_updated', sessionId: currentSessionDetails.id, newStatus: 'completed' });
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <DashboardHeader 
        title={currentSessionDetails.session_name || "Slide Editor"} 
        user={user}
      >
        <div className="flex items-center gap-2">
          {isSharedAccess && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-2">
                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
                      {userRole === 'viewer' ? (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>View Only</span>
                        </>
                      ) : userRole === 'reviewer' ? (
                        <>
                          <MessageSquare className="h-3 w-3" />
                          <span>Reviewer</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>{userRole}</span>
                        </>
                      )}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {userRole === 'viewer' ? (
                    <p>You have view-only access to this session</p>
                  ) : userRole === 'reviewer' ? (
                    <p>You can view and add comments to this session</p>
                  ) : (
                    <p>You are the {userRole} of this session</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <SyncStatusIndicator />
          {currentSessionDetails && currentSessionDetails.status === 'in_progress' && canEdit && (
            <Button onClick={handleMarkComplete} size="sm" variant="outline">
              Mark as Complete
            </Button>
          )}
          <Button 
            onClick={handleExport} 
            disabled={
              slidesLoading || 
              isSessionDetailsLoading || 
              currentSessionDetails?.status !== 'completed' ||
              !canEdit ||
              isExporting
            } 
            size="sm"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : "Export PPTX"}
          </Button>
        </div>
      </DashboardHeader>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Slide Navigator */}
        <div className="flex h-full flex-col border-r">
          <div className="border-b p-2">
            <h2 className="text-sm font-medium text-center">Slides</h2>
          </div>
          <div className="flex-1">
            <SlideNavigator />
          </div>
        </div>

        {/* Center - Slide Canvas */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          <SlideCanvas
            slide={slideToDisplay}
            onTextClick={handleTextClick}
            editable={canEdit}
            showReadingOrder={false}
          />
        </div>

        {/* Right sidebar - Comments Panel */}
        <div className={`w-80 flex-none overflow-y-auto border-l bg-muted/30 p-4 ${canComment ? '' : 'relative'}`}>
          {!canComment && (
            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
              <MessageSquareOff className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center px-4">
                Comments are not available with your current permissions
              </p>
            </div>
          )}
          <CommentsPanel />
        </div>
      </div>

      {/* Text Editing Dialog */}
      <Dialog open={!!activeBufferId} onOpenChange={open => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Translation</DialogTitle>
          </DialogHeader>
          {activeBuffer && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="original-text">Original Text</Label>
                <Textarea id="original-text" value={activeBuffer.originalText} readOnly rows={4} className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="translated-text">Translated Text</Label>
                <Textarea 
                  id="translated-text" 
                  value={activeBuffer.translatedText} 
                  onChange={(e) => activeBufferId && updateBuffer(activeBufferId, e.target.value)}
                  rows={4} 
                  placeholder="Enter translation..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveTranslation} disabled={!activeBuffer?.isDirty || !canEdit}>
              Save Translation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
