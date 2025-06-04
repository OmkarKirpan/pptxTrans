import { StateCreator } from 'zustand'
import type { EditBuffersState, EditBuffer } from '../types'

export const createEditBuffersSlice: StateCreator<EditBuffersState> = (set, get) => ({
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
          translatedText: translatedText || '',
          isDirty: false,
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
  
  saveBuffer: (shapeId: string) => 
    set(state => {
      const buffer = state.buffers[shapeId]
      if (!buffer) return state
      
      // In a real app, this would trigger an API call to save the translation
      return {
        buffers: {
          ...state.buffers,
          [shapeId]: {
            ...buffer,
            isDirty: false
          }
        }
      }
    }),
  
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