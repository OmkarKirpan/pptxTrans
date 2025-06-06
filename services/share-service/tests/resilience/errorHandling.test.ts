import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { shareController } from '../../src/controllers/shareController';
import { errorHandler } from '../../src/middleware/error-handler';
import { SharePermission } from '../../src/models/share';

// Mock all external dependencies
vi.mock('../../src/db/shareRepository');
vi.mock('../../src/utils/jwt');
vi.mock('@supabase/supabase-js');

describe('Error Handling and Resilience Tests', () => {
  let app: Hono;
  let mockRepository: any;
  let mockJwt: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    app = new Hono();
    app.use('*', errorHandler());
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

  describe('Database Connection Failures', () => {
    test('should handle Supabase unavailability gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockRejectedValue(
        new Error('Connection timeout: Unable to reach database')
      );

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

    test('should handle database connection timeouts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.listSharesBySessionId.mockRejectedValue(
        new Error('TIMEOUT: Query execution exceeded 30 seconds')
      );

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
    });

    test('should handle partial database failures', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Session lookup succeeds
      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      // But share creation fails
      mockRepository.createShare.mockRejectedValue(
        new Error('Deadlock detected: Transaction was aborted')
      );

      mockJwt.generateShareToken.mockResolvedValue('jwt-token');
      mockJwt.verifyShareToken.mockResolvedValue({
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

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

    test('should handle network partitions', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Network error: ECONNREFUSED')
      );

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
    });
  });

  describe('Authentication Service Failures', () => {
    test('should handle auth service downtime', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Service unavailable: Authentication service is down')
      );

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: [SharePermission.VIEW],
        }),
      });

      expect(response.status).toBe(500);
    });

    test('should handle auth service rate limiting', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Rate limit exceeded: Too many auth requests')
      );

      const response = await app.request('/api/share/validate/test-token', {
        method: 'GET',
      });

      expect(response.status).toBe(500);
    });

    test('should handle malformed auth responses', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        // Malformed response - missing data structure
        user: { id: 'user-123' },
        error: null,
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
    });
  });

  describe('JWT Service Failures', () => {
    test('should handle JWT generation failures', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      mockJwt.generateShareToken.mockRejectedValue(
        new Error('Crypto error: Unable to sign token')
      );

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

    test('should handle JWT verification failures', async () => {
      mockJwt.verifyShareToken.mockRejectedValue(
        new Error('Crypto error: Unable to verify signature')
      );

      const response = await app.request('/api/share/validate/test-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    test('should handle corrupted JWT secret', async () => {
      mockJwt.generateShareToken.mockRejectedValue(
        new Error('Invalid key format: JWT secret corrupted')
      );

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: [SharePermission.VIEW],
        }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    test('should handle out of memory errors', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('JavaScript heap out of memory')
      );

      const response = await app.request('/api/share/validate/test-token', {
        method: 'GET',
      });

      expect(response.status).toBe(500);
    });

    test('should handle large payload attacks', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Simulate very large payload
      const largePayload = {
        permissions: [SharePermission.VIEW],
        name: 'A'.repeat(10000), // Very long name
        expiresIn: '7d',
      };

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(largePayload),
      });

      // Should handle gracefully, either with validation error or processing
      expect([400, 413, 500]).toContain(response.status);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle concurrent share creation attempts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      // First few succeed, then simulate resource contention
      mockJwt.generateShareToken
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2')
        .mockRejectedValue(new Error('Resource temporarily unavailable'));

      mockJwt.verifyShareToken.mockResolvedValue({
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockRepository.createShare.mockResolvedValue({
        id: 'share-123',
        share_token_jti: 'jti-123',
      });

      const requests = Array.from({ length: 5 }, () =>
        app.request('/api/share/sessions/session-123/shares', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permissions: [SharePermission.VIEW],
          }),
        })
      );

      const responses = await Promise.all(requests);
      
      // Some should succeed, some should fail gracefully
      const successCount = responses.filter(r => r.status === 201).length;
      const errorCount = responses.filter(r => r.status >= 500).length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(errorCount).toBeGreaterThan(0);
    });

    test('should handle race conditions in share validation', async () => {
      // Simulate race condition where share is revoked between JWT verification and DB lookup
      mockJwt.verifyShareToken.mockResolvedValue({
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // First call succeeds, subsequent calls fail (share was revoked)
      mockRepository.findActiveShareByJti
        .mockResolvedValueOnce({
          id: 'share-123',
          permissions: [SharePermission.VIEW],
        })
        .mockResolvedValue(null);

      const requests = Array.from({ length: 3 }, () =>
        app.request('/api/share/validate/test-token', {
          method: 'GET',
        })
      );

      const responses = await Promise.all(requests);
      
      // Should handle consistently
      const validResponses = responses.filter(r => r.status === 200);
      const invalidResponses = responses.filter(r => r.status === 401);
      
      expect(validResponses.length + invalidResponses.length).toBe(3);
    });
  });

  describe('Data Consistency Errors', () => {
    test('should handle orphaned share records', async () => {
      mockJwt.verifyShareToken.mockResolvedValue({
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Share exists but session was deleted
      mockRepository.findActiveShareByJti.mockResolvedValue({
        id: 'share-123',
        session_id: 'deleted-session-123',
        permissions: [SharePermission.VIEW],
      });

      const response = await app.request('/api/share/validate/orphaned-token', {
        method: 'GET',
      });

      // Should handle gracefully
      expect([200, 401]).toContain(response.status);
    });

    test('should handle permission mismatches gracefully', async () => {
      mockJwt.verifyShareToken.mockResolvedValue({
        sessionId: 'session-123',
        permissions: [SharePermission.VIEW],
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockRepository.findActiveShareByJti.mockResolvedValue({
        id: 'share-123',
        session_id: 'session-123',
        permissions: [SharePermission.COMMENT], // Mismatch
      });

      const response = await app.request('/api/share/validate/mismatched-token', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
      const responseData = await response.json();
      expect(responseData.error).toContain('permission mismatch');
    });
  });

  describe('Recovery and Graceful Degradation', () => {
    test('should provide meaningful error responses for client debugging', async () => {
      process.env.NODE_ENV = 'development';

      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Connection refused: Database not available')
      );

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
      const responseData = await response.json();
      
      // In development, should include helpful error details
      expect(responseData.error).toBe('Internal Server Error');
      expect(responseData.message).toContain('Connection refused');
    });

    test('should mask sensitive errors in production', async () => {
      process.env.NODE_ENV = 'production';

      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('API_KEY_SECRET_12345: Invalid credentials')
      );

      const response = await app.request('/api/share/sessions/session-123/shares', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(500);
      const responseData = await response.json();
      
      // In production, should not leak sensitive information
      expect(responseData.error).toBe('Internal Server Error');
      expect(responseData.message).toBeUndefined();
      expect(JSON.stringify(responseData)).not.toContain('API_KEY_SECRET');
    });

    test('should maintain service availability during partial failures', async () => {
      // Share validation should work even if creation is failing
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

      const validationResponse = await app.request('/api/share/validate/test-token', {
        method: 'GET',
      });

      expect(validationResponse.status).toBe(200);
    });
  });

  describe('Idempotency and Retry Safety', () => {
    test('should handle duplicate share creation attempts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockRepository.getSessionByIdAndOwner.mockResolvedValue({
        id: 'session-123',
        user_id: 'user-123',
      });

      mockJwt.generateShareToken.mockResolvedValue('same-token');
      mockJwt.verifyShareToken.mockResolvedValue({
        jti: 'same-jti',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // First creation succeeds
      mockRepository.createShare
        .mockResolvedValueOnce({
          id: 'share-123',
          share_token_jti: 'same-jti',
        })
        // Second creation fails due to duplicate JTI
        .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const payload = {
        permissions: [SharePermission.VIEW],
        expiresIn: '7d',
      };

      const response1 = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const response2 = await app.request('/api/share/sessions/session-123/shares', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(500); // Duplicate constraint violation
    });
  });
});