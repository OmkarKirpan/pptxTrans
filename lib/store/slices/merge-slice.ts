import { StateCreator } from 'zustand'
import type { MergeState, MergeSelection } from '../types'

export const createMergeSlice: StateCreator<MergeState> = (set, get) => ({
  selections: {},
  isMergeMode: false,
  
  enterMergeMode: () => 
    set({ isMergeMode: true }),
  
  exitMergeMode: () => 
    set({ isMergeMode: false }),
  
  toggleShapeSelection: (slideId: string, shapeId: string) => 
    set(state => {
      // Get current selection for this slide or create a new one
      const currentSelection = state.selections[slideId] || { 
        slideId, 
        selectedShapeIds: [] 
      }
      
      const isCurrentlySelected = currentSelection.selectedShapeIds.includes(shapeId)
      
      // Toggle selection
      const newSelectedShapeIds = isCurrentlySelected
        ? currentSelection.selectedShapeIds.filter(id => id !== shapeId)
        : [...currentSelection.selectedShapeIds, shapeId]
        
      return {
        selections: {
          ...state.selections,
          [slideId]: {
            ...currentSelection,
            selectedShapeIds: newSelectedShapeIds
          }
        }
      }
    }),
  
  clearSelection: (slideId: string) => 
    set(state => {
      const { [slideId]: _, ...remainingSelections } = state.selections
      return { selections: remainingSelections }
    }),
  
  clearAllSelections: () => 
    set({ selections: {} }),
}) 