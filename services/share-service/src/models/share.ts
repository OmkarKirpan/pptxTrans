import { z } from 'zod';

// Schema for share creation
export const shareCreateSchema = z.object({
  sessionId: z.string().uuid(),
  permissions: z.object({
    read: z.boolean().default(true),
    comment: z.boolean().default(false),
    edit: z.boolean().default(false),
  }),
  email: z.string().email().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type ShareCreate = z.infer<typeof shareCreateSchema>;

// Schema for share validation
export const shareValidateSchema = z.object({
  token: z.string().min(10),
});

export type ShareValidate = z.infer<typeof shareValidateSchema>;

// Schema for share revocation
export const shareRevokeSchema = z.object({
  shareId: z.string().uuid(),
});

export type ShareRevoke = z.infer<typeof shareRevokeSchema>;

// Schema for listing shares
export const shareListSchema = z.object({
  sessionId: z.string().uuid(),
});

export type ShareList = z.infer<typeof shareListSchema>;

/**
 * Represents the permissions available for a share.
 */
export enum SharePermission {
  VIEW = 'VIEW',
  COMMENT = 'COMMENT',
  // EDIT = 'EDIT', // Future permission
}

/**
 * Represents a record in the 'session_shares' table.
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
}

/**
 * Data required to create a new share record.
 */
export interface CreateShareData {
  session_id: string;
  share_token_jti: string;
  permissions: SharePermission[];
  expires_at: Date; // Use Date object for easier manipulation before DB insertion
  created_by: string;
  name?: string;
}

/**
 * Data returned when a share is successfully created.
 */
export interface CreatedShareInfo {
  id: string;
  share_token_jti: string;
  share_url: string; // The actual URL to share (e.g., /shared/{token})
  expires_at: string;
  permissions: SharePermission[];
  name?: string | null;
} 