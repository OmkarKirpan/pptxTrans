import { test, expect, describe, beforeEach } from 'bun:test';
import { authMiddleware } from '../../../src/middleware/auth';
import { MockSupabaseClient } from '../../utils/mock-supabase';
import { createMockContext, createMockUser, extractJsonFromResponse, assertResponseStatus } from '../../utils/test-helpers';

const mockSupabase = new MockSupabaseClient();

// Mock the db import
(globalThis as any).mockSupabase = mockSupabase;

describe('Auth Middleware', () => {
  beforeEach(() => {
    mockSupabase.clearMocks();
  });

  test('should authenticate valid JWT token', async () => {
    const mockUser = createMockUser();
    mockSupabase.setAuthUser(mockUser);

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer valid-token' : '';

    let nextCalled = false;
    const next = async () => { nextCalled = true; };

    await authMiddleware(context as any, next);

    expect(nextCalled).toBe(true);
    expect(context.get('user')).toEqual(mockUser);
  });

  test('should reject missing Authorization header', async () => {
    const context = createMockContext();
    context.req.header = () => '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Missing or malformed token');
    }
  });

  test('should reject malformed Authorization header', async () => {
    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'InvalidFormat token' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Missing or malformed token');
    }
  });

  test('should reject empty token', async () => {
    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer ' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Missing token');
    }
  });

  test('should reject invalid token', async () => {
    mockSupabase.setAuthError({ message: 'Invalid token' });

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer invalid-token' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Invalid token');
    }
  });

  test('should reject expired token', async () => {
    mockSupabase.setAuthError({ message: 'Token expired' });

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer expired-token' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Invalid token');
    }
  });

  test('should handle Supabase service unavailability', async () => {
    mockSupabase.setAuthError({ message: 'Service unavailable' });

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer valid-token' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Invalid token');
    }
  });

  test('should handle unexpected errors gracefully', async () => {
    // Mock a scenario where getUser throws an unexpected error
    const originalGetUser = mockSupabase.auth.getUser;
    mockSupabase.auth.getUser = async () => {
      throw new Error('Unexpected error');
    };

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer valid-token' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 500);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Internal server error during authentication');
    }

    // Restore original method
    mockSupabase.auth.getUser = originalGetUser;
  });

  test('should handle missing user in response', async () => {
    mockSupabase.setAuthUser(null);

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer valid-token' : '';

    const next = async () => { throw new Error('Next should not be called'); };

    const result = await authMiddleware(context as any, next);

    if (result instanceof Response) {
      assertResponseStatus(result, 401);
      const data = await extractJsonFromResponse(result);
      expect(data.error).toBe('Unauthorized: Invalid token');
    }
  });

  test('should set user email when available', async () => {
    const mockUser = createMockUser();
    mockUser.email = 'test@example.com';
    mockSupabase.setAuthUser(mockUser);

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer valid-token' : '';

    let nextCalled = false;
    const next = async () => { nextCalled = true; };

    await authMiddleware(context as any, next);

    expect(nextCalled).toBe(true);
    expect(context.get('user')).toEqual(mockUser);
  });

  test('should handle user without email', async () => {
    const mockUser = createMockUser();
    delete mockUser.email;
    mockSupabase.setAuthUser(mockUser);

    const context = createMockContext();
    context.req.header = (name: string) => name === 'Authorization' ? 'Bearer valid-token' : '';

    let nextCalled = false;
    const next = async () => { nextCalled = true; };

    await authMiddleware(context as any, next);

    expect(nextCalled).toBe(true);
    expect(context.get('user')).toEqual(mockUser);
  });
});