import { Migration } from '../types';

/**
 * Migration to add color property to comments
 * 
 * This migration:
 * 1. Adds a default color to each existing comment
 * 2. Updates the schema version to 2
 */
const v2Migration: Migration = {
  version: 2,
  up: (state: any) => {
    // Skip if no comments in state
    if (!state.comments) {
      return state;
    }

    // Create a new comments object with the added color property
    const updatedComments = Object.entries(state.comments).reduce((result: Record<string, any[]>, [shapeId, comments]) => {
      result[shapeId] = (comments as any[]).map((comment: any) => ({
        ...comment,
        color: comment.color || '#3490dc', // Default blue color
      }));
      return result;
    }, {} as Record<string, any[]>);

    return {
      ...state,
      comments: updatedComments,
      // Update the schema version
      currentVersion: 2,
    };
  }
};

export default v2Migration; 