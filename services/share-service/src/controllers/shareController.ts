import { Context, Next, Hono } from 'hono';
import { createFactory } from 'hono/factory';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateShareToken, verifyShareToken, ShareTokenPayload } from '../utils/jwt';
import {
  createShare,
  listSharesBySessionId,
  revokeShareByJti,
  findActiveShareByJti,
  getSessionByIdAndOwner
} from '../db/shareRepository';
import { CreateShareData, SharePermission, CreatedShareInfo, ShareRecord } from '../models/share';
import { HTTPException } from 'hono/http-exception';
import { rateLimiter } from 'hono-rate-limiter';
import { authMiddleware } from '../middleware/authMiddleware';

// Environment variables
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000'; // For constructing share URLs

// --- Zod Schemas for Validation ---
const createShareSchema = z.object({
  permissions: z.array(z.nativeEnum(SharePermission)).min(1),
  expiresIn: z.string().optional().default('7d'), // e.g., '7d', '1h', '30m'
  name: z.string().optional(),
});

// --- Helper Functions ---
function getSupabaseClient(c: Context): SupabaseClient {
  const supabase = c.get('supabase');
  if (!supabase) {
    throw new HTTPException(500, { message: 'Supabase client not available in context' });
  }
  return supabase as SupabaseClient;
}

function getUserId(c: Context): string {
  const userId = c.get('userId'); // Assuming auth middleware sets this
  if (!userId) {
    throw new HTTPException(401, { message: 'User not authenticated' });
  }
  return userId as string;
}

// --- Controller Handlers ---
const factory = createFactory();

/**
 * Creates a new share link/token for a session.
 * POST /api/v1/sessions/:sessionId/shares
 */
export const createShareHandler = factory.createHandlers(
  zValidator('json', createShareSchema),
  async (c) => {
    const supabase = getSupabaseClient(c);
    const authenticatedUserId = getUserId(c);
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      throw new HTTPException(400, { message: 'Session ID is required.' });
    }
    const { permissions, expiresIn, name } = c.req.valid('json');

    // 1. Verify session ownership
    const session = await getSessionByIdAndOwner(supabase, sessionId, authenticatedUserId);
    if (!session) {
      throw new HTTPException(404, { message: 'Session not found or user is not the owner.' });
    }

    // 2. Generate JWT share token
    const shareTokenString = await generateShareToken(sessionId, permissions, expiresIn);
    const decodedToken = await verifyShareToken(shareTokenString); // To get JTI and EXP

    if (!decodedToken.jti || !decodedToken.exp) {
        throw new HTTPException(500, { message: 'Failed to extract JTI or EXP from generated token.' });
    }

    // 3. Prepare data for database
    const shareData: CreateShareData = {
      session_id: sessionId,
      share_token_jti: decodedToken.jti,
      permissions,
      expires_at: new Date(decodedToken.exp * 1000), // exp is in seconds
      created_by: authenticatedUserId,
      name,
    };

    // 4. Save share record to DB
    const createdRecord = await createShare(supabase, shareData);

    // 5. Construct share URL and respond
    const shareUrl = `${APP_BASE_URL}/shared?token=${shareTokenString}`;
    
    const response: CreatedShareInfo = {
        id: createdRecord.id,
        share_token_jti: createdRecord.share_token_jti,
        share_url: shareUrl,
        expires_at: createdRecord.expires_at,
        permissions: createdRecord.permissions,
        name: createdRecord.name,
    };

    return c.json(response, 201);
  }
);

/**
 * Lists all active shares for a given session.
 * GET /api/v1/sessions/:sessionId/shares
 */
export const listSharesHandler = async (c: Context) => {
  const supabase = getSupabaseClient(c);
  const authenticatedUserId = getUserId(c);
  const sessionId = c.req.param('sessionId');
  if (!sessionId) {
    throw new HTTPException(400, { message: 'Session ID is required for listing shares.' });
  }

  // 1. Verify session ownership (optional but good practice before listing shares)
  const session = await getSessionByIdAndOwner(supabase, sessionId, authenticatedUserId);
  if (!session) {
    throw new HTTPException(404, { message: 'Session not found or user is not the owner.' });
  }

  // 2. Fetch shares
  const shares = await listSharesBySessionId(supabase, sessionId, authenticatedUserId);
  return c.json(shares);
};

/**
 * Revokes a share token.
 * DELETE /api/v1/shares/:shareTokenJti
 */
export const revokeShareHandler = async (c: Context) => {
  const supabase = getSupabaseClient(c);
  const authenticatedUserId = getUserId(c);
  const shareTokenJti = c.req.param('shareTokenJti');
  if (!shareTokenJti) {
    throw new HTTPException(400, { message: 'Share token JTI is required for revocation.' });
  }

  // 1. Revoke the share
  // The repository function `revokeShareByJti` ensures the user owns the share implicitly
  // by checking `created_by` during the update.
  try {
    const revokedRecord = await revokeShareByJti(supabase, shareTokenJti, authenticatedUserId);
    return c.json({ message: 'Share token revoked successfully.', data: revokedRecord });
  } catch (error: any) {
    if (error.message.includes('Share not found')) { // Check for specific error from repo
        throw new HTTPException(404, { message: error.message });
    }
    throw new HTTPException(500, { message: error.message || 'Failed to revoke share token.' });
  }
};

/**
 * Validates a share token and returns its details (payload).
 * GET /api/v1/shares/validate/:token
 * This endpoint is likely public or used by frontend to verify a token from a URL.
 */
export const validateShareTokenHandler = async (c: Context) => {
    const supabase = getSupabaseClient(c); // May not need supabase if only verifying JWT initially
    const token = c.req.param('token');
    if (!token) {
      throw new HTTPException(400, { message: 'Token is required for validation.' });
    }

    try {
        const payload = await verifyShareToken(token);

        // Additionally, check if the JTI is in the database and not revoked
        if (!payload.jti) {
            throw new HTTPException(400, { message: 'Token JTI not found in payload.' });
        }
        const shareRecord = await findActiveShareByJti(supabase, payload.jti);
        if (!shareRecord) {
            throw new HTTPException(401, { message: 'Share token is invalid, revoked, or expired.' });
        }

        // Check if DB record permissions match token permissions (consistency check)
        if (JSON.stringify(shareRecord.permissions.sort()) !== JSON.stringify(payload.permissions.sort())) {
            console.warn(`Permissions mismatch for JTI ${payload.jti}: DB says ${shareRecord.permissions}, token says ${payload.permissions}`);
            // Decide on policy: strictly fail, or trust one source (e.g., DB as source of truth)
            // For now, we will consider it an invalid token if they don't match.
            throw new HTTPException(401, { message: 'Share token permission mismatch.' });
        }

        return c.json({ valid: true, payload: shareRecord }); // Return DB record for consistency

    } catch (error: any) {
        if (error instanceof HTTPException) throw error;
        throw new HTTPException(401, { message: error.message || 'Invalid share token.' });
    }
};

// Create a Hono app instance for share routes
const shareApi = new Hono();

// Rate limiter configuration (example: 10 requests per minute per IP)
const generalRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: 'draft-6', 
  keyGenerator: (c: Context) => c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || c.env?.ip || 'global',
});

const strictRateLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 10, // Limit each IP to 10 requests per windowMs for sensitive operations
    standardHeaders: 'draft-6',
    keyGenerator: (c: Context) => c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || c.env?.ip || 'global',
});

// Apply auth middleware to routes that require authentication
shareApi.use('/sessions/:sessionId/shares*', authMiddleware, strictRateLimiter); // Add rate limiter to authed routes too
shareApi.use('/shares/:shareTokenJti', authMiddleware, strictRateLimiter); // For revoke

// Define routes
shareApi.post('/sessions/:sessionId/shares', ...createShareHandler);
shareApi.get('/sessions/:sessionId/shares', listSharesHandler);
shareApi.delete('/shares/:shareTokenJti', revokeShareHandler);

// Public route for validating a token - apply general rate limiter here
shareApi.get('/validate/:token', generalRateLimiter, validateShareTokenHandler);

export { shareApi as shareController }; 