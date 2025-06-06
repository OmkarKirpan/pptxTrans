import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import useAppStore from '@/lib/store'
import { ProcessedSlide, SlideShape } from '@/types'

// Create Supabase client
const supabase = createClient()

/**
 * Service for handling real-time synchronization with Supabase
 */
export class RealTimeSync {
  private channels: Map<string, RealtimeChannel> = new Map()
  private initialized = false
  
  /**
   * Initialize real-time sync for a session
   * @param sessionId The session ID to subscribe to
   */
  public subscribeToSession(sessionId: string) {
    if (this.channels.has(sessionId)) {
      console.log(`Already subscribed to session ${sessionId}`)
      return
    }

    // Subscribe to slides changes
    const slidesChannel = supabase
      .channel(`slides:session=${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slides',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Slides change received:', payload)
          this.handleSlideChange(payload)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slide_shapes',
          filter: `slide.session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Shape change received:', payload)
          this.handleShapeChange(payload)
        }
      )
      .subscribe((status) => {
        console.log(`Subscription status for session ${sessionId}:`, status)
      })

    this.channels.set(sessionId, slidesChannel)
    this.initialized = true
  }

  /**
   * Unsubscribe from a session
   * @param sessionId The session ID to unsubscribe from
   */
  public unsubscribeFromSession(sessionId: string) {
    const channel = this.channels.get(sessionId)
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(sessionId)
    }
  }

  /**
   * Unsubscribe from all sessions
   */
  public unsubscribeAll() {
    for (const [sessionId, channel] of this.channels.entries()) {
      channel.unsubscribe()
      this.channels.delete(sessionId)
    }
  }

  /**
   * Handle slide change from Supabase real-time
   */
  private handleSlideChange(payload: any) {
    const { eventType, new: newSlide, old: oldSlide } = payload
    const store = useAppStore.getState()

    switch (eventType) {
      case 'INSERT':
        // Add new slide to the store
        store.addSlide(newSlide as ProcessedSlide)
        break
      case 'UPDATE':
        // Update existing slide in the store
        store.setSlides(
          store.slides.map((slide) => 
            slide.id === newSlide.id ? { ...slide, ...newSlide } : slide
          )
        )
        break
      case 'DELETE':
        // Remove slide from the store
        store.removeSlide(oldSlide.id)
        break
    }
  }

  /**
   * Handle shape change from Supabase real-time
   */
  private handleShapeChange(payload: any) {
    const { eventType, new: newShape, old: oldShape } = payload
    const store = useAppStore.getState()

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        // Find the slide this shape belongs to
        const slideId = newShape.slide_id
        const slide = store.slides.find((s) => s.id === slideId)
        
        if (slide) {
          // Update the shapes for this slide
          const updatedShapes = eventType === 'INSERT'
            ? [...slide.shapes, newShape as SlideShape]
            : slide.shapes.map((shape) => 
                shape.id === newShape.id ? { ...shape, ...newShape } : shape
              )
          
          store.updateSlideShapes(slideId, updatedShapes)
        }
        break
      case 'DELETE':
        // Find the slide this shape belonged to
        const oldSlideId = oldShape.slide_id
        const oldSlide = store.slides.find((s) => s.id === oldSlideId)
        
        if (oldSlide) {
          // Remove the shape from the slide
          const updatedShapes = oldSlide.shapes.filter((shape) => shape.id !== oldShape.id)
          store.updateSlideShapes(oldSlideId, updatedShapes)
        }
        break
    }
  }
}

// Create a singleton instance
export const realTimeSync = new RealTimeSync()

// Hook to use the real-time sync service
export function useRealTimeSync() {
  return {
    subscribeToSession: (sessionId: string) => realTimeSync.subscribeToSession(sessionId),
    unsubscribeFromSession: (sessionId: string) => realTimeSync.unsubscribeFromSession(sessionId),
    unsubscribeAll: () => realTimeSync.unsubscribeAll(),
  }
} 