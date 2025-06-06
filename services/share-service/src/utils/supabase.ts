import { createClient } from '@supabase/supabase-js';
import { createLogger } from './logger';

const logger = createLogger('supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Supabase URL or key not provided');
  throw new Error('Supabase URL and key must be provided');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types for TypeScript
export interface Share {
  id: string;
  session_id: string;
  share_token: string;
  role: 'reviewer' | 'viewer' | 'commenter';
  permissions: {
    read: boolean;
    comment: boolean;
    edit: boolean;
  };
  email?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Helper functions for database operations
export async function createShare(data: Omit<Share, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const { data: share, error } = await supabase
      .from('session_shares')
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Error creating share');
      throw error;
    }

    return share;
  } catch (error) {
    logger.error({ error }, 'Error in createShare');
    throw error;
  }
}

export async function getShareByToken(token: string) {
  try {
    const { data: share, error } = await supabase
      .from('session_shares')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error) {
      logger.error({ error }, 'Error getting share by token');
      throw error;
    }

    return share;
  } catch (error) {
    logger.error({ error }, 'Error in getShareByToken');
    throw error;
  }
}

export async function getSharesBySession(sessionId: string) {
  try {
    const { data: shares, error } = await supabase
      .from('session_shares')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      logger.error({ error }, 'Error getting shares by session');
      throw error;
    }

    return shares;
  } catch (error) {
    logger.error({ error }, 'Error in getSharesBySession');
    throw error;
  }
}

export async function deleteShare(shareId: string) {
  try {
    const { error } = await supabase
      .from('session_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      logger.error({ error }, 'Error deleting share');
      throw error;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Error in deleteShare');
    throw error;
  }
} 