import { SharePermission, CreateShareData, ShareRecord } from '../../src/models/share';

export const validCreateShareData: CreateShareData = {
  session_id: 'b8f7e7c4-1234-4567-8901-123456789012',
  share_token_jti: 'c9e8f7d6-1234-4567-8901-123456789012',
  permissions: [SharePermission.VIEW],
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  created_by: 'a1b2c3d4-1234-4567-8901-123456789012',
  name: 'Test Share Link',
  share_url: 'http://localhost:3000/shared/test-token',
};

export const shareRecordFixture: ShareRecord = {
  id: 'share-123',
  session_id: 'b8f7e7c4-1234-4567-8901-123456789012',
  share_token_jti: 'c9e8f7d6-1234-4567-8901-123456789012',
  permissions: [SharePermission.VIEW],
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_by: 'a1b2c3d4-1234-4567-8901-123456789012',
  created_at: new Date().toISOString(),
  revoked_at: null,
  name: 'Test Share Link',
  share_url: 'http://localhost:3000/shared/test-token',
};

export const revokedShareRecord: ShareRecord = {
  ...shareRecordFixture,
  revoked_at: new Date().toISOString(),
};

export const multiPermissionShareRecord: ShareRecord = {
  ...shareRecordFixture,
  permissions: [SharePermission.VIEW, SharePermission.COMMENT],
};

export const sessionFixture = {
  id: 'b8f7e7c4-1234-4567-8901-123456789012',
  user_id: 'a1b2c3d4-1234-4567-8901-123456789012',
  title: 'Test Translation Session',
  created_at: new Date().toISOString(),
};

export const userFixture = {
  id: 'a1b2c3d4-1234-4567-8901-123456789012',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
};

export const validJwtPayload = {
  sessionId: 'b8f7e7c4-1234-4567-8901-123456789012',
  permissions: [SharePermission.VIEW],
  iss: 'ShareService',
  aud: 'PptxTranslatorApp',
  jti: 'c9e8f7d6-1234-4567-8901-123456789012',
  exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
  iat: Math.floor(Date.now() / 1000),
};

export const expiredJwtPayload = {
  ...validJwtPayload,
  exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
};

// Request body fixtures
export const validCreateShareRequest = {
  permissions: [SharePermission.VIEW],
  expiresIn: '7d',
  name: 'Test Share Link',
};

export const multiPermissionCreateRequest = {
  permissions: [SharePermission.VIEW, SharePermission.COMMENT],
  expiresIn: '24h',
  name: 'Multi-permission Share',
};

export const invalidCreateShareRequests = {
  emptyPermissions: {
    permissions: [],
    expiresIn: '7d',
  },
  invalidPermissions: {
    permissions: ['INVALID_PERMISSION'],
    expiresIn: '7d',
  },
  missingPermissions: {
    expiresIn: '7d',
    name: 'Missing permissions',
  },
  invalidExpiry: {
    permissions: [SharePermission.VIEW],
    expiresIn: 'invalid-time',
  },
};