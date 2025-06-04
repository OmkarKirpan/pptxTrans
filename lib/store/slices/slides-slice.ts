import { StateCreator } from 'zustand'
import type { SlidesState } from '../types'
import type { ProcessedSlide, SlideShape } from '@/types'
import { createClient } from '@/lib/supabase/client'

// Create Supabase client
const supabase = createClient()

export const createSlidesSlice: StateCreator<SlidesState> = (set, get) => ({
  slides: [],
  currentSlideId: null,
  slidesLoading: false,
  slidesError: null,
  syncStatus: {
    isSyncing: false,
    lastSynced: null,
    error: null,
  },
  reorderState: {
    isReordering: false,
    draggedSlideId: null,
    targetPosition: null,
  },

  setSlides: (slides: ProcessedSlide[]) => 
    set({ 
      slides, 
      currentSlideId: slides.length > 0 ? slides[0].id : null,
      slidesError: null 
    }),
  
  setCurrentSlide: (slideId: string) => 
    set({ currentSlideId: slideId }),
  
  updateSlideShapes: (slideId: string, shapes: SlideShape[]) => 
    set(state => ({
      slides: state.slides.map(slide => 
        slide.id === slideId 
          ? { ...slide, shapes } 
          : slide
      )
    })),
  
  addSlide: (slide: ProcessedSlide) => 
    set(state => ({
      slides: [...state.slides, slide]
    })),
  
  removeSlide: (slideId: string) => 
    set(state => ({
      slides: state.slides.filter(s => s.id !== slideId),
      currentSlideId: state.currentSlideId === slideId 
        ? (state.slides[0]?.id || null) 
        : state.currentSlideId
    })),
  
  reorderSlides: (fromIndex: number, toIndex: number) => 
    set(state => {
      const newSlides = [...state.slides]
      const [movedSlide] = newSlides.splice(fromIndex, 1)
      newSlides.splice(toIndex, 0, movedSlide)
      
      // Update slide numbers
      const updatedSlides = newSlides.map((slide, index) => ({
        ...slide,
        slide_number: index + 1
      }))

      // Sync with server
      get().syncSlidesOrder(updatedSlides)
      
      return { slides: updatedSlides }
    }),
  
  setSlidesLoading: (loading: boolean) => 
    set({ slidesLoading: loading }),
  
  setSlidesError: (error: string | null) => 
    set({ slidesError: error }),
  
  // Reorder actions
  startReorder: (slideId: string) => 
    set({
      reorderState: {
        isReordering: true,
        draggedSlideId: slideId,
        targetPosition: null,
      }
    }),
  
  updateReorderTarget: (position: number) => 
    set(state => ({
      reorderState: {
        ...state.reorderState,
        targetPosition: position
      }
    })),
  
  completeReorder: () => {
    const state = get()
    if (state.reorderState.draggedSlideId && state.reorderState.targetPosition !== null) {
      const fromIndex = state.slides.findIndex(s => s.id === state.reorderState.draggedSlideId)
      const toIndex = state.reorderState.targetPosition
      
      if (fromIndex !== -1 && fromIndex !== toIndex) {
        get().reorderSlides(fromIndex, toIndex)
      }
    }
    
    set({
      reorderState: {
        isReordering: false,
        draggedSlideId: null,
        targetPosition: null,
      }
    })
  },
  
  cancelReorder: () => 
    set({
      reorderState: {
        isReordering: false,
        draggedSlideId: null,
        targetPosition: null,
      }
    }),

  // New sync methods
  setSyncStatus: (status: Partial<SlidesState['syncStatus']>) =>
    set(state => ({
      syncStatus: {
        ...state.syncStatus,
        ...status
      }
    })),

  // Update a shape with optimistic UI updates and server sync
  updateShape: async (slideId: string, shapeId: string, updatedData: Partial<SlideShape>) => {
    // Optimistic update in the local state
    set(state => ({
      slides: state.slides.map(slide => {
        if (slide.id === slideId) {
          return {
            ...slide,
            shapes: slide.shapes.map(shape => {
              if (shape.id === shapeId) {
                return {
                  ...shape,
                  ...updatedData,
                  // Add a pending flag to indicate this is optimistically updated
                  _pendingUpdate: true
                }
              }
              return shape
            })
          }
        }
        return slide
      }),
      syncStatus: {
        ...state.syncStatus,
        isSyncing: true,
      }
    }))

    try {
      // Sync with server
      const { error } = await supabase
        .from('slide_shapes')
        .update({
          ...updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', shapeId)

      if (error) {
        throw error
      }

      // Update sync status on success
      set(state => ({
        syncStatus: {
          isSyncing: false,
          lastSynced: new Date().toISOString(),
          error: null
        },
        // Remove pending flag from the shape
        slides: state.slides.map(slide => {
          if (slide.id === slideId) {
            return {
              ...slide,
              shapes: slide.shapes.map(shape => {
                if (shape.id === shapeId) {
                  const { _pendingUpdate, ...restShape } = shape
                  return restShape
                }
                return shape
              })
            }
          }
          return slide
        })
      }))
    } catch (error) {
      console.error('Error updating shape:', error)
      
      // Set error status and revert the optimistic update if needed
      set(state => ({
        syncStatus: {
          isSyncing: false,
          lastSynced: state.syncStatus.lastSynced,
          error: error instanceof Error ? error.message : 'Failed to update shape'
        }
      }))
    }
  },

  // Sync slide order with server
  syncSlidesOrder: async (slides: ProcessedSlide[]) => {
    set(state => ({
      syncStatus: {
        ...state.syncStatus,
        isSyncing: true
      }
    }))

    try {
      // Create an array of updates to be processed in a transaction
      const updates = slides.map((slide, index) => ({
        id: slide.id,
        slide_number: index + 1,
        updated_at: new Date().toISOString()
      }))

      // Use Supabase's upsert to update all slides in one go
      const { error } = await supabase
        .from('slides')
        .upsert(updates)

      if (error) {
        throw error
      }

      // Update sync status on success
      set({
        syncStatus: {
          isSyncing: false,
          lastSynced: new Date().toISOString(),
          error: null
        }
      })
    } catch (error) {
      console.error('Error syncing slide order:', error)
      
      // Set error status
      set(state => ({
        syncStatus: {
          isSyncing: false,
          lastSynced: state.syncStatus.lastSynced,
          error: error instanceof Error ? error.message : 'Failed to sync slide order'
        }
      }))
    }
  },
}) 