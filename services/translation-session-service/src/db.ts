import { createClient } from '@supabase/supabase-js';

// TODO: Generate and import Supabase types specifically for this service 
// or establish a shared types package for better type safety.
// For now, using <any> to proceed.
// import type { Database } from '@/types/supabase'; 

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Supabase URL is not defined in environment variables.');
}
if (!supabaseAnonKey) {
  throw new Error('Supabase Anon Key is not defined in environment variables.');
}

// If you have generated types for your database (e.g., using `supabase gen types typescript`)
// you can use them here for better type safety.
// Replace `Database` with your actual generated type name if different.
// If you don't have generated types yet, you can use `createClient<any>` or omit the generic.
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

// Example of how you might structure DB calls later (to be moved to controller.ts or a service layer)
/*
import { TranslationSession, CreateSessionPayload, UpdateSessionPayload } from './model';

export async function getSessionByIdFromDb(sessionId: string, userId: string): Promise<TranslationSession | null> {
  const { data, error } = await supabase
    .from('translation_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching session by ID:', error);
    // Handle specific errors, e.g., not found vs. other DB errors
    if (error.code === 'PGRST116') { // PostgREST error for zero rows returned by .single()
        return null;
    }
    throw error; // Or return a more specific error object
  }
  return data as TranslationSession;
}
*/ 