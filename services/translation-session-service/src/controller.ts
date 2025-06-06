import { Context } from 'hono';
import { z } from 'zod';
import {
  TranslationSession,
  CreateSessionPayload,
  UpdateSessionPayload,
  PaginatedSessions,
} from '@/model'; // Assuming model.ts is at src/model.ts
import { supabase } from '@/db'; // Assuming db.ts is at src/db.ts

// Zod Schemas for validation (as planned in integration doc)
const createSessionSchema = z.object({
  session_name: z.string().min(1, "Session name is required"),
  original_file_name: z.string().optional(),
  source_language_code: z.string().min(1, "Source language is required"),
  target_language_codes: z.array(z.string().min(1)).min(1, "At least one target language is required"),
  slide_count: z.number().int().positive().optional(),
});

const updateSessionSchema = z.object({
  session_name: z.string().min(1).optional(),
  original_file_name: z.string().optional(), // Added as per model flexibility
  source_language_code: z.string().min(1).optional(), // Added as per model flexibility
  target_language_codes: z.array(z.string().min(1)).min(1).optional(), // Added as per model flexibility
  slide_count: z.number().int().positive().optional(), // Added as per model flexibility
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional(),
  last_opened_at: z.string().datetime({ offset: true }).optional(), // ISO 8601
});

// Helper to get user from context (set by authMiddleware)
const getAuthenticatedUser = (c: Context): { id: string } | null => {
  const user = c.get('user');
  if (!user || typeof user.id !== 'string') {
    return null;
  }
  return user as { id: string }; // Cast to expected shape
};

export const sessionController = {
  async createSession(c: Context): Promise<Response> {
    const user = getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: 'User not authenticated or user ID missing' }, 401);
    }

    let payload: CreateSessionPayload;
    try {
      const body = await c.req.json();
      payload = createSessionSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid input', details: error.errors }, 400);
      }
      return c.json({ error: 'Invalid request body' }, 400);
    }

    try {
      const { data, error } = await supabase
        .from('translation_sessions')
        .insert({
          ...payload,
          user_id: user.id,
          // status will default to 'draft' as per table definition
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session in DB:', error);
        return c.json({ error: 'Failed to create session', details: error.message }, 500);
      }
      return c.json(data as TranslationSession, 201);
    } catch (dbError: any) {
      console.error('Unexpected DB error creating session:', dbError);
      return c.json({ error: 'An unexpected error occurred', details: dbError.message }, 500);
    }
  },

  async listSessions(c: Context): Promise<Response> {
    const user = getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: 'User not authenticated or user ID missing' }, 401);
    }

    const { 
        status: statusQuery,
        sortBy: sortByQuery,
        page: pageQuery = '1', // Default to page 1
        limit: limitQuery = '10' // Default to 10 items per page
    } = c.req.query();

    const page = parseInt(pageQuery, 10);
    const limit = parseInt(limitQuery, 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('translation_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (statusQuery) {
      query = query.eq('status', statusQuery);
    }

    // Basic sorting, e.g., sortBy=updated_at_desc or sortBy=name_asc
    if (sortByQuery) {
      const [field, orderDirection] = sortByQuery.split('_');
      const ascending = orderDirection === 'asc';
      if (field && ['updated_at', 'created_at', 'session_name', 'status'].includes(field)) {
         query = query.order(field, { ascending });
      }
    }
    
    query = query.range(offset, offset + limit - 1);

    try {
      const { data, error, count } = await query;

      if (error) {
        console.error('Error listing sessions from DB:', error);
        return c.json({ error: 'Failed to list sessions', details: error.message }, 500);
      }
      
      const totalItems = count ?? 0;

      return c.json({
        items: data as TranslationSession[],
        total: totalItems,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalItems / limit)
      } as PaginatedSessions);
    } catch (dbError: any) {
      console.error('Unexpected DB error listing sessions:', dbError);
      return c.json({ error: 'An unexpected error occurred', details: dbError.message }, 500);
    }
  },

  async getSessionById(c: Context): Promise<Response> {
    const user = getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: 'User not authenticated or user ID missing' }, 401);
    }
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
        return c.json({ error: 'Session ID is required' }, 400);
    }

    try {
        const { data, error } = await supabase
            .from('translation_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', user.id) // Ensure user owns the session
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                return c.json({ error: 'Session not found' }, 404);
            }
            console.error('Error getting session by ID from DB:', error);
            return c.json({ error: 'Failed to get session', details: error.message }, 500);
        }
        return c.json(data as TranslationSession);
    } catch (dbError: any) {
        console.error('Unexpected DB error getting session by ID:', dbError);
        return c.json({ error: 'An unexpected error occurred', details: dbError.message }, 500);
    }
  },

  async updateSession(c: Context): Promise<Response> {
    const user = getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: 'User not authenticated or user ID missing' }, 401);
    }
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
        return c.json({ error: 'Session ID is required' }, 400);
    }

    let payload: UpdateSessionPayload;
    try {
        const body = await c.req.json();
        payload = updateSessionSchema.parse(body);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid input', details: error.errors }, 400);
        }
        return c.json({ error: 'Invalid request body' }, 400);
    }
    
    if (Object.keys(payload).length === 0) {
        return c.json({ error: 'No fields to update provided' }, 400);
    }

    try {
        const { data, error } = await supabase
            .from('translation_sessions')
            .update(payload)
            .eq('id', sessionId)
            .eq('user_id', user.id) // Ensure user owns the session
            .select()
            .single(); // to get the updated record back

        if (error) {
            if (error.code === 'PGRST116') { // Not found or RLS prevented update
                // Check if session exists at all for this user before concluding it's just RLS
                const { count } = await supabase.from('translation_sessions').select('id', {count: 'exact'}).eq('id', sessionId).eq('user_id', user.id);
                if (count === 0) {
                    return c.json({ error: 'Session not found or access denied' }, 404);
                }
                // If it exists but update failed, it might be an RLS issue not caught by select or other constraint
                 return c.json({ error: 'Failed to update session, possible access issue or invalid data' }, 500);
            }
            console.error('Error updating session in DB:', error);
            return c.json({ error: 'Failed to update session', details: error.message }, 500);
        }
        return c.json(data as TranslationSession);
    } catch (dbError: any) {
        console.error('Unexpected DB error updating session:', dbError);
        return c.json({ error: 'An unexpected error occurred', details: dbError.message }, 500);
    }
  },

  async deleteSession(c: Context): Promise<Response> {
    const user = getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: 'User not authenticated or user ID missing' }, 401);
    }
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
        return c.json({ error: 'Session ID is required' }, 400);
    }

    try {
        // First, verify the session exists and the user owns it, to give a 404 if not.
        const { error: checkError, count } = await supabase
            .from('translation_sessions')
            .select('id', { count: 'exact' })
            .eq('id', sessionId)
            .eq('user_id', user.id);

        if (checkError || count === 0) {
             if (checkError && checkError.code !== 'PGRST116') console.error('DB check error before delete:', checkError);
            return c.json({ error: 'Session not found or access denied' }, 404);
        }
        
        const { error: deleteError } = await supabase
            .from('translation_sessions')
            .delete()
            .eq('id', sessionId)
            .eq('user_id', user.id); // RLS also enforces this, but good for clarity

        if (deleteError) {
            console.error('Error deleting session from DB:', deleteError);
            return c.json({ error: 'Failed to delete session', details: deleteError.message }, 500);
        }
        return c.body(null, 204); // Or c.json({ message: 'Session deleted successfully' }, 200)
    } catch (dbError: any) {
        console.error('Unexpected DB error deleting session:', dbError);
        return c.json({ error: 'An unexpected error occurred', details: dbError.message }, 500);
    }
  },
}; 