"use client" // For client-side interactions and state hooks

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import DashboardHeader from "@/components/dashboard/dashboard-header"
import SlideNavigator from "@/components/editor/slide-navigator" // Assuming this is updated for ProcessedSlide thumbnails
import SlideCanvas from "@/components/editor/slide-canvas"
import CommentsPanel from "@/components/editor/comments-panel"
import { createClient } from "@/lib/supabase/client"
import type { ProcessedSlide, TranslationSession } from "@/types" // Updated type
import { Loader2, AlertTriangle } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuditLog } from "@/hooks/useAuditLog" // Import audit log hook

// Import Zustand hooks
import { useSession, useSlides, useEditBuffers } from "@/lib/store"

// MOCK DATA using ProcessedSlide and new SlideShape structure
const MOCK_PROCESSED_SLIDES: ProcessedSlide[] = [
  {
    id: "proc_slide_1",
    session_id: "mock_session_1",
    slide_number: 1,
    svg_url: "/placeholder.svg?width=1280&height=720",
    original_width: 1280,
    original_height: 720,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    shapes: [
      {
        id: "s1_shp1_txt",
        slide_id: "proc_slide_1",
        type: "text",
        original_text: "Main Title of Presentation",
        translated_text: "Título Principal de la Presentación",
        x_coordinate: 10, // percentage
        y_coordinate: 15, // percentage
        width: 80, // percentage
        height: 15, // percentage
        coordinates_unit: "percentage",
        font_family: "Arial",
        font_size: 44, // points
        is_bold: true,
        text_color: "#333333",
        text_align: "center",
        has_comments: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "s1_shp2_txt",
        slide_id: "proc_slide_1",
        type: "text",
        original_text: "Subtitle or key message here.",
        x_coordinate: 10,
        y_coordinate: 35,
        width: 80,
        height: 10,
        coordinates_unit: "percentage",
        font_family: "Calibri",
        font_size: 28, // points
        text_color: "#555555",
        text_align: "center",
        has_comments: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "proc_slide_2",
    session_id: "mock_session_1",
    slide_number: 2,
    svg_url: "/placeholder.svg?width=1280&height=720",
    original_width: 1280,
    original_height: 720,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    shapes: [
      {
        id: "s2_shp1_txt",
        slide_id: "proc_slide_2",
        type: "text",
        original_text: "Key Point 1",
        x_coordinate: 5,
        y_coordinate: 10,
        width: 40,
        height: 8,
        coordinates_unit: "percentage",
        font_size: 24,
        has_comments: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "s2_shp2_img_placeholder", // This shape won't be interactive if not 'text' type
        slide_id: "proc_slide_2",
        type: "image_placeholder", // Not 'text', so won't get an overlay
        x_coordinate: 50,
        y_coordinate: 20,
        width: 45,
        height: 60,
        coordinates_unit: "percentage",
        has_comments: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
]

export default function SlideEditorPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const sessionId = params.sessionId as string
  
  // Initialize audit logging
  const { createAuditEvent } = useAuditLog(sessionId)

  // Use Zustand store hooks
  const {
    currentSession,
    setSession,
    setLoading: setSessionLoading,
    isLoading: isSessionLoading,
    error: sessionError,
    setError: setSessionError
  } = useSession()
  
  const {
    slides,
    currentSlideId,
    currentSlide,
    setSlides,
    setCurrentSlide,
    updateSlideShapes,
    slidesLoading,
    setSlidesLoading,
    slidesError,
    setSlidesError
  } = useSlides()
  
  const {
    activeBufferId,
    activeBuffer,
    createBuffer,
    updateBuffer,
    saveBuffer,
    setActiveBuffer
  } = useEditBuffers()

  // Store for user data (not in Zustand yet)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setSessionLoading(true)
      setSlidesLoading(true)
      
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !authUser) {
        router.push("/auth/login")
        return
      }
      setUser(authUser)

      // In a real app: Fetch session details and then fetch its processed slides & shapes
      // const { data: sessionData, error: sessionError } = await supabase.from("translation_sessions")...
      // const { data: slidesData, error: slidesError } = await supabase.from("slides").select("*, shapes:slide_shapes(*)").eq("session_id", sessionId)...
      const mockSessionData: TranslationSession | undefined = {
        id: sessionId,
        user_id: authUser.id,
        name: `Presentation ${sessionId.substring(0, 6)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "in-progress",
        progress: 33,
        slide_count: MOCK_PROCESSED_SLIDES.length,
        thumbnail_url: MOCK_PROCESSED_SLIDES[0]?.svg_url || null,
        original_file_path: `user_files/presentation_${sessionId}.pptx`,
      }

      if (!mockSessionData) {
        setSessionError("Failed to load session details.")
      } else {
        // Update Zustand store
        setSession(mockSessionData, 'owner')
        setSlides(MOCK_PROCESSED_SLIDES)
        if (MOCK_PROCESSED_SLIDES.length > 0) {
          setCurrentSlide(MOCK_PROCESSED_SLIDES[0].id)
        }
        
        // Log view event
        createAuditEvent('view', { initialSlide: MOCK_PROCESSED_SLIDES[0]?.slide_number || 1 })

        // Log view event when editor is first loaded
        createAuditEvent('view', {
          sessionId,
          action: 'editor_opened'
        })
      }
      
      setSessionLoading(false)
      setSlidesLoading(false)
    }
    
    if (sessionId) {
      fetchData()
    }
  }, [sessionId, supabase, router, createAuditEvent, setSession, setSlides, setCurrentSlide, setSessionLoading, setSlidesLoading, setSessionError])

  const handleSelectSlide = (slideId: string) => {
    setCurrentSlide(slideId)
    
    // Log slide selection
    const selected = slides.find((s) => s.id === slideId)
    if (selected) {
      createAuditEvent('view', { slideNumber: selected.slide_number })
    }
  }

  const handleTextClick = (
    shapeId: string, 
    originalText: string, 
    currentTranslation?: string,
    shapeData?: any
  ) => {
    // Create or update buffer
    createBuffer(shapeId, currentSlide?.id || '', originalText, currentTranslation)
    
    // Log text selection event with enhanced data
    createAuditEvent('view', {
      slideId: currentSlide?.id,
      slideNumber: currentSlide?.slide_number,
      shapeId,
      action: 'opened_text_editor',
      shapeDetails: shapeData
    })
  }

  const handleSaveTranslation = async () => {
    if (!currentSlide || !activeBufferId || !activeBuffer) return

    try {
      // Find the shape in the current slide
      const shape = currentSlide.shapes.find(sh => sh.id === activeBufferId)
      if (!shape) return
      
      // Create new shape with updated translation
      const updatedShape = {
        ...shape,
        translated_text: activeBuffer.translatedText
      }
      
      // Update slide shapes in the store
      const updatedShapes = currentSlide.shapes.map(sh => 
        sh.id === activeBufferId ? updatedShape : sh
      )
      
      updateSlideShapes(currentSlide.id, updatedShapes)
      
      // Save buffer (marks as not dirty)
      saveBuffer(activeBufferId)
      
      // Close editor
      setActiveBuffer(null)

      // Log translation save
      createAuditEvent('edit', {
        action: 'save_translation',
        shapeId: activeBufferId,
        slideNumber: currentSlide.slide_number
      })
    } catch (error) {
      console.error("Failed to save translation:", error)
      // ... error handling ...
    }
  }

  const handleExport = async () => {
    try {
      // ... existing export logic ...
      
      // Log export event
      createAuditEvent('export', {
        format: 'pptx',
        slideCount: slides.length
      })
    } catch (error) {
      console.error("Export failed:", error)
      // ... error handling ...
    }
  }

  // Handle dialog close
  const handleCloseDialog = () => {
    setActiveBuffer(null)
  }

  if (isSessionLoading || slidesLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-xl">Loading slide editor...</p>
      </div>
    )
  }

  if (sessionError || slidesError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-xl text-destructive">{sessionError || slidesError}</p>
        <Button className="mt-4" onClick={() => router.push("/dashboard")}>
          Return to Dashboard
        </Button>
      </div>
    )
  }

  if (!currentSession || !currentSlide) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-warning" />
        <p className="mt-4 text-xl">Session or slide data not found.</p>
        <Button className="mt-4" onClick={() => router.push("/dashboard")}>
          Return to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <DashboardHeader user={user} />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Slide Navigator */}
        <div className="w-64 flex-none overflow-y-auto border-r bg-muted/30 p-4">
          <SlideNavigator
            slides={slides}
            currentSlideId={currentSlideId}
            onSelectSlide={handleSelectSlide}
          />
        </div>

        {/* Center - Slide Canvas */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          <SlideCanvas
            slide={currentSlide}
            onTextClick={handleTextClick}
            editable={true}
            showReadingOrder={false}
          />
        </div>

        {/* Right sidebar - Comments Panel */}
        <div className="w-80 flex-none overflow-y-auto border-l bg-muted/30 p-4">
          <CommentsPanel />
        </div>
      </div>

      {/* Text Editing Dialog */}
      <Dialog open={!!activeBufferId} onOpenChange={open => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Translation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="original-text">Original Text</Label>
              <div className="rounded-md bg-muted p-3 text-sm">{activeBuffer?.originalText}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="translated-text">Translation</Label>
              <Textarea
                id="translated-text"
                value={activeBuffer?.translatedText || ''}
                onChange={(e) => activeBufferId && updateBuffer(activeBufferId, e.target.value)}
                placeholder="Enter translation here..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveTranslation}>Save Translation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
