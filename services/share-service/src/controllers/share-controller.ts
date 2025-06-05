import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { 
  shareCreateSchema, 
  shareValidateSchema, 
  shareRevokeSchema, 
  shareListSchema 
} from '../models/share';
import { createLogger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { 
  createShare, 
  getShareByToken, 
  getSharesBySession, 
  deleteShare,
  Share
} from '../utils/supabase';
import { generateToken, verifyToken } from '../utils/token';

const logger = createLogger('share-controller');
const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

export const shareController = new Hono();

// Generate a share link
shareController.post('/', zValidator('json', shareCreateSchema), async (c) => {
  const { sessionId, permissions, email, expiresAt } = c.req.valid('json');

  try {
    // Determine role based on permissions
    let role: 'viewer' | 'commenter' | 'reviewer' = 'viewer';
    if (permissions.edit) {
      role = 'reviewer';
    } else if (permissions.comment) {
      role = 'commenter';
    }
    
    // Create share record in database
    const share = await createShare({
      session_id: sessionId,
      share_token: '', // Will update with JWT
      role,
      permissions,
      email,
      expires_at: expiresAt,
    });
    
    // Generate JWT token
    const expirySeconds = expiresAt 
      ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      : undefined;
      
    const token = await generateToken({
      sessionId,
      shareId: share.id,
      permissions,
    }, expirySeconds);
    
    // Update the share record with the token
    const { error } = await c.env.supabase
      .from('session_shares')
      .update({ share_token: token })
      .eq('id', share.id);
      
    if (error) {
      throw new AppError('Error updating share token', 500);
    }
    
    // Generate share URL
    const shareUrl = `${baseUrl}/shared/${encodeURIComponent(token)}`;
    
    return c.json({
      shareToken: token,
      shareUrl,
    });
  } catch (error) {
    logger.error({ error }, 'Error creating share');
    throw new AppError('Error creating share', 500);
  }
});

// Validate a share token
shareController.get('/validate', zValidator('query', shareValidateSchema), async (c) => {
  const { token } = c.req.valid('query');
  
  try {
    // Verify JWT
    const payload = await verifyToken(token);
    
    // Check if token exists in database
    const share = await getShareByToken(token);
    if (!share) {
      throw new AppError('Share not found', 404);
    }
    
    // Check if share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new AppError('Share has expired', 401);
    }
    
    return c.json({
      valid: true,
      sessionId: share.session_id,
      permissions: share.permissions,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error }, 'Error validating token');
    throw new AppError('Invalid token', 401);
  }
});

// List shares for a session
shareController.get('/list', zValidator('query', shareListSchema), async (c) => {
  const { sessionId } = c.req.valid('query');
  
  try {
    const shares = await getSharesBySession(sessionId);
    return c.json(shares);
  } catch (error) {
    logger.error({ error }, 'Error listing shares');
    throw new AppError('Error listing shares', 500);
  }
});

// Revoke a share
shareController.delete('/revoke', zValidator('json', shareRevokeSchema), async (c) => {
  const { shareId } = c.req.valid('json');
  
  try {
    await deleteShare(shareId);
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error revoking share');
    throw new AppError('Error revoking share', 500);
  }
}); 