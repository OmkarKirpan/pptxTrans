import { StateCreator } from 'zustand'
import type { SlidesState } from '../types'
import type { ProcessedSlide, SlideShape } from '@/types'

export const createSlidesSlice: StateCreator<SlidesState> = (set, get) => ({
  slides: [],
  currentSlideId: null,
  slidesLoading: false,
  slidesError: null,
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
      return {
        slides: newSlides.map((slide, index) => ({
          ...slide,
          slide_number: index + 1
        }))
      }
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
}) 