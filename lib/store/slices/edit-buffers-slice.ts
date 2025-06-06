import { StateCreator } from 'zustand'
import type { EditBuffersState, EditBuffer } from '../types'
import { SlidesState } from '../types'

export const createEditBuffersSlice: StateCreator<
  EditBuffersState & SlidesState,
  [],
  [],
  EditBuffersState
> = (set, get) => ({
  buffers: {},
  activeBufferId: null,

  createBuffer: (shapeId: string, slideId: string, originalText: string, translatedText?: string) => 
    set(state => ({
      buffers: {
        ...state.buffers,
        [shapeId]: {
          shapeId,
          slideId,
          originalText,
          translatedText: translatedText || originalText,
          isDirty: translatedText ? translatedText !== originalText : false,
          lastModified: new Date()
        }
      },
      activeBufferId: shapeId
    })),
  
  updateBuffer: (shapeId: string, translatedText: string) => 
    set(state => {
      const buffer = state.buffers[shapeId]
      if (!buffer) return state
      
      return {
        buffers: {
          ...state.buffers,
          [shapeId]: {
            ...buffer,
            translatedText,
            isDirty: translatedText !== buffer.originalText,
            lastModified: new Date()
          }
        }
      }
    }),
  
  saveBuffer: async (shapeId: string) => {
    const buffer = get().buffers[shapeId]
    if (buffer && buffer.isDirty) {
      try {
        await get().updateShape(buffer.slideId, buffer.shapeId, { translated_text: buffer.translatedText })
        
        set(state => ({
          buffers: {
            ...state.buffers,
            [shapeId]: { ...buffer, isDirty: false },
          },
        }))
      } catch (error) {
        console.error("Error saving buffer (syncing shape update):", error)
        throw error
      }
    }
  },
  
  discardBuffer: (shapeId: string) => 
    set(state => {
      const { [shapeId]: _, ...remainingBuffers } = state.buffers
      return {
        buffers: remainingBuffers,
        activeBufferId: state.activeBufferId === shapeId ? null : state.activeBufferId
      }
    }),
  
  setActiveBuffer: (shapeId: string | null) => 
    set({ activeBufferId: shapeId }),
  
  clearBuffers: () => 
    set({ buffers: {}, activeBufferId: null }),
}) 