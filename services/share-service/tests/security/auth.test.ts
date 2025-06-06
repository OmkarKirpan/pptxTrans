import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { shareController } from '../../src/controllers/shareController';
import { authMiddleware } from '../../src/middleware/authMiddleware';
import { SharePermission } from '../../src/models/share';

// Mock dependencies
vi.mock('../../src/db/shareRepository');
vi.mock('../../src/utils/jwt');
vi.mock('@supabase/supabase-js');

describe('Security Tests', () => {
  let app: Hono;
  let mockRepository: any;
  let mockJwt: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/share', shareController);

    mockRepository = require('../../src/db/shareRepository');
    mockJwt = require('../../src/utils/jwt');

    mockSupabaseClient = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
      }),
    };

    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabaseClient);

    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SHARE_TOKEN_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Security', () => {
    test('should reject requests without Authorization header', async () => {
      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: [SharePermission.VIEW] }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    test('should reject malformed Bearer tokens', async () => {
      const malformedTokens = [
        'Bearer',
        'Bearer ',
        'Basic dGVzdDp0ZXN0',
        'Bearer token with spaces',
        'NotBearer token-here',
        '',
      ];

      for (const token of malformedTokens) {
        const response = await app.request('/api/share/sessions/session-123/shares', {
          method: 'POST',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissions: [SharePermission.VIEW] }),
        });

        expect(response.status).toBe(401);
      }
    });

    test('should reject expired tokens', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' },
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer expired-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: [SharePermission.VIEW] }),
      });

      expect(response.status).toBe(401);
    });

    test('should reject tokens with invalid signatures', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT signature' },
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer tampered.token.signature',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: [SharePermission.VIEW] }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization Security', () => {
    test('should prevent access to other users sessions', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // User tries to access session they don't own
      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null);

      const response = await app.request('/api/share/sessions/other-users-session/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: [SharePermission.VIEW] }),
      });

      expect(response.status).toBe(404);
    });

    test('should prevent revoking other users shares', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.revokeShareByJti.mockRejectedValue(new Error('Share not found'));

      const response = await app.request('/api/share/shares/other-users-jti', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(404);
    });

    test('should enforce session ownership on listing shares', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null);

      const response = await app.request('/api/share/sessions/not-owned-session/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Input Validation Security', () => {
    test('should reject invalid UUID formats', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const invalidUUIDs = [
        'not-a-uuid',
        '12345',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await app.request(`/api/share/sessions/${invalidUUID}/shares`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissions: [SharePermission.VIEW] }),
        });

        // Should fail validation or not find session
        expect([400, 404, 500]).toContain(response.status);
      }
    });

    test('should sanitize and validate permissions', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const invalidPermissions = [
        [],
        ['INVALID_PERMISSION'],
        ['<script>alert("xss")</script>'],
        [null],
        [undefined],
        'not-an-array',
      ];

      for (const permissions of invalidPermissions) {
        const response = await app.request('/api/share/sessions/session-123/shares', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissions }),
        });

        expect(response.status).toBe(400);
      }
    });

    test('should validate expiry time formats', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      const invalidExpiryTimes = [
        'invalid-time',
        '<script>alert("xss")</script>',
        '999999999999d',
        '',
        null,
      ];

      for (const expiresIn of invalidExpiryTimes) {
        const response = await app.request('/api/share/sessions/session-123/shares', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permissions: [SharePermission.VIEW],
            expiresIn,
          }),
        });

        expect([400, 500]).toContain(response.status);
      }
    });
  });

  describe('Token Security', () => {
    test('should reject tokens with missing claims', async () => {
      const incompletePayload = {
        sessionId: 'session-123',
        // Missing permissions
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verifyShareToken.mockResolvedValue(incompletePayload);

      const response = await app.request('/api/share/validate/incomplete-token', {
        method: 'GET',
      });

      // Should handle missing claims gracefully
      expect([400, 401]).toContain(response.status);
    });

    test('should reject tokens with mismatched permissions', async () => {
      const tokenPayload = {
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const dbRecord = {
        id: 'share-123',
        session_id: 'session-123',
        share_token_jti: 'jti-123',
        permissions: [SharePermission.COMMENT], // Different permissions
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        revoked_at: null,
      };

      mockJwt.verifyShareToken.mockResolvedValue(tokenPayload);
      mockRepository.findActiveShareByJti.mockResolvedValue(dbRecord);

      const response = await app.request('/api/share/validate/mismatched-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    test('should reject revoked tokens', async () => {
      const tokenPayload = {
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verifyShareToken.mockResolvedValue(tokenPayload);
      mockRepository.findActiveShareByJti.mockResolvedValue(null); // Token revoked

      const response = await app.request('/api/share/validate/revoked-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting Security', () => {
    test('should enforce rate limits per IP', async () => {
      const clientIP = '192.168.1.100';
      
      // Mock successful validation to focus on rate limiting
      mockJwt.verifyShareToken.mockResolvedValue({
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockRepository.findActiveShareByJti.mockResolvedValue({
        id: 'share-123',
        permissions: [SharePermission.VIEW],
      });

      // Make requests exceeding rate limit
      const requests = Array.from({ length: 35 }, () =>
        app.request('/api/share/validate/test-token', {
          method: 'GET',
          headers: { 'X-Forwarded-For': clientIP },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should enforce stricter rate limits for authenticated endpoints', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });
      mockRepository.listSharesBySessionId.mockResolvedValue([]);

      const clientIP = '192.168.1.101';
      
      const requests = Array.from({ length: 15 }, () =>
        app.request('/api/share/sessions/session-123/shares', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-token',
            'X-Forwarded-For': clientIP,
          },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Error Information Disclosure', () => {
    test('should not leak sensitive information in error messages', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockRejectedValue(
        new Error('Database connection string: postgresql://user:password@host:5432/db')
      );

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
      const responseData = await response.json();
      
      // Should not contain sensitive database information
      expect(JSON.stringify(responseData)).not.toContain('password');
      expect(JSON.stringify(responseData)).not.toContain('postgresql://');
    });

    test('should mask authentication errors in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Internal authentication service error: API_KEY_INVALID' },
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
      const responseData = await response.json();
      
      // Should not leak internal error details
      expect(JSON.stringify(responseData)).not.toContain('API_KEY_INVALID');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Cross-User Data Access Prevention', () => {
    test('should prevent listing shares from different users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock session owned by different user
      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null);

      const response = await app.request('/api/share/sessions/other-user-session/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(404);
      expect(mockRepository.listSharesBySessionId).not.toHaveBeenCalled();
    });

    test('should verify share ownership before revocation', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock repository to simulate attempting to revoke another user's share
      mockRepository.revokeShareByJti.mockRejectedValue(new Error('Share not found'));

      const response = await app.request('/api/share/shares/other-user-jti', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('JWT Secret Security', () => {
    test('should handle missing JWT secret gracefully', async () => {
      delete process.env.SHARE_TOKEN_SECRET;

      // This should be caught at startup, but test runtime handling
      mockJwt.verifyShareToken.mockRejectedValue(new Error('JWT secret not configured'));

      const response = await app.request('/api/share/validate/test-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
      
      // Restore for other tests
      process.env.SHARE_TOKEN_SECRET = 'test-secret-key';
    });
  });
});