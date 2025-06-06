import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { shareController } from '../../../src/controllers/shareController';
import { authMiddleware } from '../../../src/middleware/authMiddleware';
import { errorHandler } from '../../../src/middleware/error-handler';
import { SharePermission } from '../../../src/models/share';
import { createTestSupabaseClient } from '../../setup';

// Mock external dependencies
vi.mock('../../../src/db/shareRepository');
vi.mock('../../../src/utils/jwt');
vi.mock('@supabase/supabase-js');

describe('Share API Integration Tests', () => {
  let app: Hono;
  let mockRepository: any;
  let mockJwt: any;
  let mockSupabaseClient: any;

  beforeAll(() => {
    // Set up test environment
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SHARE_TOKEN_SECRET = 'test-secret-key-for-jwt-testing';
    process.env.APP_BASE_URL = 'http://localhost:3000';
  });

  beforeEach(() => {
    // Create fresh app instance
    app = new Hono();
    app.use('*', errorHandler());
    app.route('/api/share', shareController);

    // Import mocked modules
    mockRepository = require('../../../src/db/shareRepository');
    mockJwt = require('../../../src/utils/jwt');

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
      }),
    };

    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/share/sessions/:sessionId/shares', () => {
    const validPayload = {
      permissions: [SharePermission.VIEW],
      expiresIn: '7d',
      name: 'Test Share',
    };

    test('should create share with valid authenticated request', async () => {
      // Mock auth success
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock repository responses
      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      mockJwt.generateShareToken.mockResolvedValue('jwt-token-123');
      mockJwt.verifyShareToken.mockResolvedValue({
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });

      mockRepository.createShare.mockResolvedValue({
        id: 'share-123',
        session_id: 'session-123',
        share_token_jti: 'jti-123',
        permissions: [SharePermission.VIEW],
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: 'user-123',
        created_at: new Date().toISOString(),
        revoked_at: null,
        name: 'Test Share',
        share_url: 'http://localhost:3000/shared/jwt-token-123',
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(201);
      const responseData = await response.json();
      expect(responseData).toMatchObject({
        id: 'share-123',
        share_token_jti: 'jti-123',
        share_url: expect.stringContaining('http://localhost:3000/shared/'),
        permissions: [SharePermission.VIEW],
        name: 'Test Share',
      });
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(401);
      const responseData = await response.json();
      expect(responseData.error).toContain('Unauthorized');
    });

    test('should return 400 for invalid JSON body', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: 'invalid-json',
      });

      expect(response.status).toBe(400);
    });

    test('should return 400 for validation errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const invalidPayload = {
        permissions: [], // Empty permissions array
        expiresIn: '7d',
      };

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe('Validation Error');
      expect(responseData.details).toBeDefined();
    });

    test('should return 404 for non-existent session', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null);

      const response = await app.request('/api/share/sessions/nonexistent-session/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(404);
    });

    test('should handle rate limiting', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock successful responses for rate limit testing
      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });
      mockJwt.generateShareToken.mockResolvedValue('jwt-token');
      mockJwt.verifyShareToken.mockResolvedValue({
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });
      mockRepository.createShare.mockResolvedValue({
        id: 'share-123',
        share_token_jti: 'jti-123',
        permissions: [SharePermission.VIEW],
      });

      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 15 }, () =>
        app.request('/api/share/sessions/session-123/shares', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
            'X-Forwarded-For': '192.168.1.1', // Same IP for rate limiting
          },
          body: JSON.stringify(validPayload),
        })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/share/sessions/:sessionId/shares', () => {
    test('should list shares for authenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      const mockShares = [
        {
          id: 'share-1',
          session_id: 'session-123',
          permissions: [SharePermission.VIEW],
          created_at: new Date().toISOString(),
        },
        {
          id: 'share-2',
          session_id: 'session-123',
          permissions: [SharePermission.VIEW, SharePermission.COMMENT],
          created_at: new Date().toISOString(),
        },
      ];

      mockRepository.listSharesBySessionId.mockResolvedValue(mockShares);

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData).toHaveLength(2);
      expect(responseData[0].id).toBe('share-1');
      expect(responseData[1].id).toBe('share-2');
    });

    test('should return empty array when no shares exist', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      mockRepository.listSharesBySessionId.mockResolvedValue([]);

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData).toEqual([]);
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/share/shares/:shareTokenJti', () => {
    test('should revoke share successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const revokedShare = {
        id: 'share-123',
        share_token_jti: 'jti-123',
        revoked_at: new Date().toISOString(),
      };

      mockRepository.revokeShareByJti.mockResolvedValue(revokedShare);

      const response = await app.request('/api/share/shares/jti-123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.message).toBe('Share token revoked successfully.');
      expect(responseData.data).toEqual(revokedShare);
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await app.request('/api/share/shares/jti-123', {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });

    test('should return 404 for non-existent share', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.revokeShareByJti.mockRejectedValue(new Error('Share not found'));

      const response = await app.request('/api/share/shares/nonexistent-jti', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/share/validate/:token', () => {
    test('should validate valid token', async () => {
      const mockPayload = {
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockShareRecord = {
        id: 'share-123',
        session_id: 'session-123',
        share_token_jti: 'jti-123',
        permissions: [SharePermission.VIEW],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        revoked_at: null,
      };

      mockJwt.verifyShareToken.mockResolvedValue(mockPayload);
      mockRepository.findActiveShareByJti.mockResolvedValue(mockShareRecord);

      const response = await app.request('/api/share/validate/valid-jwt-token', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.valid).toBe(true);
      expect(responseData.payload).toEqual(mockShareRecord);
    });

    test('should return 401 for invalid token', async () => {
      mockJwt.verifyShareToken.mockRejectedValue(new Error('Invalid token'));

      const response = await app.request('/api/share/validate/invalid-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    test('should return 401 for revoked token', async () => {
      const mockPayload = {
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verifyShareToken.mockResolvedValue(mockPayload);
      mockRepository.findActiveShareByJti.mockResolvedValue(null); // Token revoked or not found

      const response = await app.request('/api/share/validate/revoked-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    test('should handle rate limiting for public endpoint', async () => {
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

      // Make multiple rapid requests from same IP
      const requests = Array.from({ length: 35 }, () =>
        app.request('/api/share/validate/valid-token', {
          method: 'GET',
          headers: {
            'X-Forwarded-For': '192.168.1.2', // Same IP
          },
        })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database connection errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error).toBe('Internal Server Error');
    });

    test('should handle authentication service errors', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Auth service unavailable'));

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer some-token',
        },
      });

      expect(response.status).toBe(500);
    });

    test('should handle JWT service errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      mockJwt.generateShareToken.mockRejectedValue(new Error('JWT service unavailable'));

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: [SharePermission.VIEW],
          expiresIn: '7d',
        }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('CORS and Security Headers', () => {
    test('should include proper CORS headers', async () => {
      const response = await app.request('/api/share/validate/some-token', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });

    test('should include security headers', async () => {
      const response = await app.request('/api/share/validate/some-token', {
        method: 'GET',
      });

      // Check for security headers (these would be added by secureHeaders middleware)
      expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
    });
  });
});