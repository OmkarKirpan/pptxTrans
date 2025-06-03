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

interface TextEditorState {
  isOpen: boolean
  shapeId: string | null
  originalText: string
  currentTranslation: string
}

export default function SlideEditorPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const sessionId = params.sessionId as string
  
  // Initialize audit logging
  const { createAuditEvent } = useAuditLog(sessionId)

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<TranslationSession | null>(null)
  const [slides, setSlides] = useState<ProcessedSlide[]>(MOCK_PROCESSED_SLIDES)
  const [currentSlide, setCurrentSlide] = useState<ProcessedSlide | null>(MOCK_PROCESSED_SLIDES[0] || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [textEditor, setTextEditor] = useState<TextEditorState>({
    isOpen: false,
    shapeId: null,
    originalText: "",
    currentTranslation: "",
  })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
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
        setError("Failed to load session details.")
      } else {
        setSession(mockSessionData)
        setSlides(MOCK_PROCESSED_SLIDES) // Using mock slides
        setCurrentSlide(MOCK_PROCESSED_SLIDES[0] || null)
        
        // Log view event
        createAuditEvent('view', { initialSlide: MOCK_PROCESSED_SLIDES[0]?.slide_number || 1 })
      }
      setLoading(false)
    }
    if (sessionId) {
      fetchData()
    }
  }, [sessionId, supabase, router, createAuditEvent])

  const handleSelectSlide = (slideId: string) => {
    const selected = slides.find((s) => s.id === slideId)
    setCurrentSlide(selected || null)
    
    // Log slide selection
    if (selected) {
      createAuditEvent('view', { slideNumber: selected.slide_number })
    }
  }

  const handleTextClick = (shapeId: string, originalText: string, currentTranslation?: string) => {
    setTextEditor({
      isOpen: true,
      shapeId,
      originalText,
      currentTranslation: currentTranslation || "",
    })
    
    // Log text selection for editing
    createAuditEvent('edit', { 
      action: 'select_text',
      shapeId, 
      slideNumber: currentSlide?.slide_number
    })
  }

  const handleSaveTranslation = async () => {
    if (!currentSlide || !textEditor.shapeId) return

    // Optimistic update
    const newSlides = slides.map((s) => {
      if (s.id === currentSlide.id) {
        return {
          ...s,
          shapes: s.shapes.map((sh) => {
            if (sh.id === textEditor.shapeId) {
              return { ...sh, translated_text: textEditor.currentTranslation }
            }
            return sh
          }),
        }
      }
      return s
    })
    setSlides(newSlides)
    setCurrentSlide(newSlides.find((s) => s.id === currentSlide.id) || null)

    // Actual save to Supabase
    const { error: updateError } = await supabase
      .from("slide_shapes")
      .update({ translated_text: textEditor.currentTranslation, updated_at: new Date().toISOString() })
      .eq("id", textEditor.shapeId)

    if (updateError) {
      console.error("Failed to save translation:", updateError)
      setError("Failed to save translation. Please try again.")
      // Revert optimistic update if needed
      setSlides(slides) // Revert to original slides state on error
      setCurrentSlide(slides.find((s) => s.id === currentSlide.id) || null)
    } else {
      console.log("Translation saved for shape:", textEditor.shapeId)
      
      // Log successful translation save
      createAuditEvent('edit', { 
        action: 'save_translation',
        shapeId: textEditor.shapeId, 
        slideNumber: currentSlide.slide_number,
        textLength: textEditor.currentTranslation.length
      })
    }

    setTextEditor({ isOpen: false, shapeId: null, originalText: "", currentTranslation: "" })
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Editor...</p>
      </div>
    )
  }

  if (error && !currentSlide) {
    // Show full page error if critical
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-lg font-semibold">Error Loading Session</p>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push("/dashboard")} className="mt-6">
          Back to Dashboard
        </Button>
      </div>
    )
  }

  // The SlideNavigator also needs to be updated to accept ProcessedSlide[]
  // and use svg_url for thumbnails if available. For now, it might use placeholders.
  // This change is not shown here but would be necessary.

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <DashboardHeader user={user} />
      <div className="flex flex-1 overflow-hidden border-t">
        <aside className="w-64 flex-shrink-0 border-r bg-background overflow-y-auto">
          {/* Ensure SlideNavigator can handle ProcessedSlide[] and use svg_url for thumbnails */}
          <SlideNavigator
            slides={slides as any[]} // Cast for now, SlideNavigator needs update
            currentSlideId={currentSlide?.id || null}
            onSelectSlide={handleSelectSlide}
          />
        </aside>

        <main className="flex-1 overflow-auto bg-muted/20">
          <SlideCanvas slide={currentSlide} editable={true} onTextClick={handleTextClick} showReadingOrder={false} />
        </main>

        <aside className="w-80 flex-shrink-0 border-l bg-background overflow-y-auto">
          <CommentsPanel />
        </aside>
      </div>

      <Dialog
        open={textEditor.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setTextEditor((prev) => ({ ...prev, isOpen: false }))
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Translation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="original-text" className="text-xs text-muted-foreground">
                Original Text (Read-only)
              </Label>
              <p id="original-text" className="mt-1 rounded-md border bg-muted p-3 text-sm max-h-32 overflow-y-auto">
                {textEditor.originalText}
              </p>
            </div>
            <div>
              <Label htmlFor="translation-input">Translation</Label>
              <Textarea
                id="translation-input"
                value={textEditor.currentTranslation}
                onChange={(e) => setTextEditor((prev) => ({ ...prev, currentTranslation: e.target.value }))}
                placeholder="Enter translation here..."
                className="mt-1 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveTranslation}>
              Save Translation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error && ( // Display non-critical errors as a toast or small message
        <div className="absolute bottom-4 right-4 bg-destructive text-destructive-foreground p-3 rounded-md shadow-lg">
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
