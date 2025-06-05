/**
 * Represents the permissions available for a share.
 * Mirrors services/share-service/src/models/share.ts
 */
export enum SharePermission {
  VIEW = 'VIEW',
  COMMENT = 'COMMENT',
  // EDIT = 'EDIT', // Future permission
}

/**
 * Represents a record in the 'session_shares' table, as returned to the frontend.
 * Mirrors services/share-service/src/models/share.ts ShareRecord
 */
export interface ShareRecord {
  id: string; // UUID
  session_id: string; // UUID, FK to translation_sessions.id
  share_token_jti: string; // Unique JWT ID (jti claim)
  permissions: SharePermission[];
  expires_at: string; // ISO 8601 timestamp string
  created_by: string; // UUID, FK to auth.users.id (the user who created the share)
  created_at: string; // ISO 8601 timestamp string
  revoked_at?: string | null; // ISO 8601 timestamp string, if revoked
  name?: string | null; // Optional user-friendly name for the share link
  share_url?: string | null; // The actual URL to share (e.g., /shared?token={JWT})
  // The actual share_token (JWT string) is NOT typically sent back when listing shares.
  // The share_url (containing the token) is sent upon creation.
}

/**
 * Data returned when a share is successfully created and sent to frontend.
 * Mirrors services/share-service/src/models/share.ts CreatedShareInfo
 */
export interface CreatedShareInfo {
  id: string;
  share_token_jti: string;
  share_url: string; // The actual URL to share (e.g., /shared?token={JWT})
  expires_at: string;
  permissions: SharePermission[];
  name?: string | null;
}

/**
 * Payload for validating a share token, returned to the frontend.
 */
export interface ValidatedShareToken {
    valid: boolean;
    payload?: ShareRecord; // Contains the full ShareRecord if valid
    message?: string; // Optional message, e.g., for invalid token reason
} 