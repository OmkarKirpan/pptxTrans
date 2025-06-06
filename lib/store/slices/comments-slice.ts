import { StateCreator } from 'zustand'
import type { CommentsState, Comment } from '../types'

export const createCommentsSlice: StateCreator<CommentsState> = (set, get) => ({
  comments: {},
  loadingComments: {},

  setComments: (shapeId: string, comments: Comment[]) => 
    set(state => ({
      comments: {
        ...state.comments,
        [shapeId]: comments
      },
      loadingComments: {
        ...state.loadingComments,
        [shapeId]: false
      }
    })),
  
  addComment: (comment: Comment) => 
    set(state => ({
      comments: {
        ...state.comments,
        [comment.shapeId]: [
          ...(state.comments[comment.shapeId] || []),
          comment
        ]
      }
    })),
  
  updateComment: (commentId: string, updates: Partial<Comment>) => 
    set(state => {
      const newComments = { ...state.comments }
      
      // Find and update the comment across all shapes
      for (const shapeId in newComments) {
        const shapeComments = newComments[shapeId]
        const commentIndex = shapeComments.findIndex(c => c.id === commentId)
        
        if (commentIndex !== -1) {
          newComments[shapeId] = [
            ...shapeComments.slice(0, commentIndex),
            { ...shapeComments[commentIndex], ...updates, updatedAt: new Date() },
            ...shapeComments.slice(commentIndex + 1)
          ]
          break
        }
      }
      
      return { comments: newComments }
    }),
  
  deleteComment: (commentId: string, shapeId: string) => 
    set(state => ({
      comments: {
        ...state.comments,
        [shapeId]: state.comments[shapeId]?.filter(c => c.id !== commentId) || []
      }
    })),
  
  setCommentsLoading: (shapeId: string, loading: boolean) => 
    set(state => ({
      loadingComments: {
        ...state.loadingComments,
        [shapeId]: loading
      }
    })),
  
  clearComments: () => 
    set({ comments: {}, loadingComments: {} }),
}) 