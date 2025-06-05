import { SupabaseClient } from '@supabase/supabase-js';
import { ShareRecord, CreateShareData, SharePermission } from '../models/share';

const SESSION_SHARES_TABLE = 'session_shares';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000'; // For constructing share URLs

/**
 * Creates a new share record in the database.
 * @param supabase The Supabase client instance.
 * @param shareData The data for the new share.
 * @returns The created ShareRecord.
 */
export async function createShare(
  supabase: SupabaseClient,
  shareData: CreateShareData
): Promise<ShareRecord> {
  const { data, error } = await supabase
    .from(SESSION_SHARES_TABLE)
    .insert({
      session_id: shareData.session_id,
      share_token_jti: shareData.share_token_jti,
      permissions: shareData.permissions,
      expires_at: shareData.expires_at.toISOString(),
      created_by: shareData.created_by,
      name: shareData.name,
      share_url: shareData.share_url, // Store the share URL in the database
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating share record:', error);
    throw new Error(`Failed to create share record: ${error.message}`);
  }
  if (!data) {
    throw new Error('Failed to create share record: No data returned.');
  }
  return data as ShareRecord;
}

/**
 * Lists all active (not revoked) shares for a given session ID, belonging to a specific user.
 * @param supabase The Supabase client instance.
 * @param sessionId The ID of the session.
 * @param userId The ID of the user who created the shares (owner).
 * @returns An array of ShareRecords.
 */
export async function listSharesBySessionId(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<ShareRecord[]> {
  const { data, error } = await supabase
    .from(SESSION_SHARES_TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .eq('created_by', userId)
    .is('revoked_at', null) // Only active shares
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing shares by session ID:', error);
    throw new Error(`Failed to list shares: ${error.message}`);
  }
  
  // If share_url is not in the database for older records, construct it here
  const sharesWithUrl = (data as ShareRecord[] || []).map(share => {
    if (!share.share_url && share.share_token_jti) {
      // We don't have the actual token here, just the JTI, so this is a best-effort approach
      // For older records without share_url, the frontend will handle this case
      return share;
    }
    return share;
  });
  
  return sharesWithUrl;
}

/**
 * Revokes a share by its JTI, ensuring the user attempting is the creator.
 * @param supabase The Supabase client instance.
 * @param shareTokenJti The JTI of the share token to revoke.
 * @param userId The ID of the user attempting to revoke (must be created_by).
 * @returns The updated ShareRecord with revoked_at set.
 */
export async function revokeShareByJti(
  supabase: SupabaseClient,
  shareTokenJti: string,
  userId: string
): Promise<ShareRecord> {
  const { data, error } = await supabase
    .from(SESSION_SHARES_TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq('share_token_jti', shareTokenJti)
    .eq('created_by', userId) // Ensure owner is revoking
    .is('revoked_at', null) // Ensure it's not already revoked
    .select()
    .single();

  if (error) {
    console.error('Error revoking share by JTI:', error);
    throw new Error(`Failed to revoke share: ${error.message}`);
  }
  if (!data) {
    throw new Error('Failed to revoke share: Share not found, not owned by user, or already revoked.');
  }
  return data as ShareRecord;
}

/**
 * Finds an active (not revoked) share record by its JTI.
 * @param supabase The Supabase client instance.
 * @param shareTokenJti The JTI of the share token.
 * @returns The ShareRecord if found and active, otherwise null.
 */
export async function findActiveShareByJti(
  supabase: SupabaseClient,
  shareTokenJti: string
): Promise<ShareRecord | null> {
  const { data, error } = await supabase
    .from(SESSION_SHARES_TABLE)
    .select('*')
    .eq('share_token_jti', shareTokenJti)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    console.error('Error finding active share by JTI:', error);
    // Don't throw an error if not found, just return null. Throw for other DB errors.
    if (error.code !== 'PGRST116') { // PGRST116: "Searched for a single row, but found no rows"
        throw new Error(`Database error finding share: ${error.message}`);
    }
  }
  return data ? (data as ShareRecord) : null;
}

/**
 * Retrieves a session by its ID and verifies ownership.
 * This function checks if the given userId is the owner of the session.
 * @param supabase The Supabase client instance.
 * @param sessionId The ID of the session.
 * @param userId The ID of the user to verify as owner.
 * @returns The session object ({id: string, user_id: string}) if found and owned by userId, otherwise null.
 */
export async function getSessionByIdAndOwner(
    supabase: SupabaseClient,
    sessionId: string,
    userId: string
): Promise<{ id: string; user_id: string } | null> {
    const { data, error } = await supabase
        .from('translation_sessions') // Assumed table name for translation sessions
        .select('id, user_id')       // Assumed user_id is the column storing the owner
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching session by ID and owner:', error);
        // PGRST116 means no rows found, which is a valid outcome (not owned or doesn't exist)
        if (error.code !== 'PGRST116') {
             throw new Error(`Database error fetching session: ${error.message}`);
        }
        return null; // Explicitly return null on PGRST116 or other non-throwing errors
    }
    return data; // data will be null if not found, or { id: string; user_id: string }
} 