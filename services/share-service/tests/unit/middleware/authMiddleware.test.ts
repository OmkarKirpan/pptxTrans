import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { authMiddleware } from '../../../src/middleware/authMiddleware';
import { createMockContext, createMockNext } from '../../helpers/testHelpers';
import { HTTPException } from 'hono/http-exception';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Auth Middleware', () => {
  let mockContext: any;
  let mockNext: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Set up environment variables
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    mockContext = createMockContext();
    mockNext = createMockNext();

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(),
      },
    };

    // Mock createClient to return our mock client
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  describe('Environment Configuration', () => {
    test('should throw error when SUPABASE_URL is missing', async () => {
      delete process.env.SUPABASE_URL;
      
      mockContext.req.header.mockReturnValue('Bearer valid-token');

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Authentication system not configured');
    });

    test('should throw error when SUPABASE_ANON_KEY is missing', async () => {
      delete process.env.SUPABASE_ANON_KEY;
      
      mockContext.req.header.mockReturnValue('Bearer valid-token');

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Authentication system not configured');
    });
  });

  describe('Authorization Header Validation', () => {
    test('should throw 401 when Authorization header is missing', async () => {
      mockContext.req.header.mockReturnValue(undefined);

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Missing or invalid token');
    });

    test('should throw 401 when Authorization header does not start with Bearer', async () => {
      mockContext.req.header.mockReturnValue('Basic invalid-auth');

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Missing or invalid token');
    });

    test('should throw 401 when Authorization header is empty Bearer', async () => {
      mockContext.req.header.mockReturnValue('Bearer ');

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Missing or invalid token');
    });

    test('should throw 401 when Authorization header is just Bearer', async () => {
      mockContext.req.header.mockReturnValue('Bearer');

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Missing or invalid token');
    });
  });

  describe('Token Authentication', () => {
    test('should authenticate valid token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
      };

      mockContext.req.header.mockReturnValue('Bearer valid-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);

      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-123');
      expect(mockContext.set).toHaveBeenCalledWith('userEmail', 'test@example.com');
      expect(mockContext.set).toHaveBeenCalledWith('supabase', mockSupabaseClient);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle user without email', async () => {
      const mockUser = {
        id: 'user-123',
        aud: 'authenticated',
        role: 'authenticated',
        // No email field
      };

      mockContext.req.header.mockReturnValue('Bearer valid-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);

      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-123');
      expect(mockContext.set).not.toHaveBeenCalledWith('userEmail', expect.anything());
      expect(mockNext).toHaveBeenCalled();
    });

    test('should throw 401 for invalid token', async () => {
      mockContext.req.header.mockReturnValue('Bearer invalid-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Invalid token');
    });

    test('should throw 401 when user is null', async () => {
      mockContext.req.header.mockReturnValue('Bearer expired-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Invalid token or user not found');
    });

    test('should handle Supabase auth errors', async () => {
      mockContext.req.header.mockReturnValue('Bearer malformed-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT malformed' },
      });

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: JWT malformed');
    });
  });

  describe('Supabase Client Configuration', () => {
    test('should create Supabase client with correct configuration', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockContext.req.header.mockReturnValue('Bearer test-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);

      const { createClient } = require('@supabase/supabase-js');
      expect(createClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'test-anon-key',
        {
          global: { headers: { Authorization: 'Bearer test-token' } },
          auth: {
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );
    });

    test('should extract token correctly from header', async () => {
      const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockContext.req.header.mockReturnValue(`Bearer ${testToken}`);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);

      const { createClient } = require('@supabase/supabase-js');
      const createClientCall = createClient.mock.calls[0];
      expect(createClientCall[2].global.headers.Authorization).toBe(`Bearer ${testToken}`);
    });
  });

  describe('Context Setting', () => {
    test('should set all required context values', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'another@example.com',
        aud: 'authenticated',
        role: 'authenticated',
      };

      mockContext.req.header.mockReturnValue('Bearer valid-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);

      // Verify userId is set
      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-456');
      
      // Verify userEmail is set
      expect(mockContext.set).toHaveBeenCalledWith('userEmail', 'another@example.com');
      
      // Verify supabase client is set
      expect(mockContext.set).toHaveBeenCalledWith('supabase', mockSupabaseClient);
      
      // Verify next is called
      expect(mockNext).toHaveBeenCalled();
    });

    test('should pass authenticated supabase client to context', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockContext.req.header.mockReturnValue('Bearer valid-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);

      const setSupabaseCall = mockContext.set.mock.calls.find(
        call => call[0] === 'supabase'
      );
      expect(setSupabaseCall[1]).toBe(mockSupabaseClient);
    });
  });

  describe('Error Handling', () => {
    test('should handle Supabase connection errors', async () => {
      mockContext.req.header.mockReturnValue('Bearer valid-token');
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Network error');
    });

    test('should handle malformed tokens gracefully', async () => {
      mockContext.req.header.mockReturnValue('Bearer malformed.token.here');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT format' },
      });

      await expect(authMiddleware(mockContext, mockNext))
        .rejects.toThrow('Unauthorized: Invalid JWT format');
    });

    test('should throw HTTPException with correct status', async () => {
      mockContext.req.header.mockReturnValue('Bearer invalid-token');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      try {
        await authMiddleware(mockContext, mockNext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }
    });
  });

  describe('Integration Scenarios', () => {
    test('should work with different token types', async () => {
      const scenarios = [
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test',
        'Bearer supabase-auth-token-12345',
        'Bearer very-long-token-string-that-might-be-used-in-production-environments',
      ];

      for (const authHeader of scenarios) {
        const mockUser = { id: `user-${Date.now()}`, email: 'test@example.com' };
        
        mockContext.req.header.mockReturnValue(authHeader);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        await expect(authMiddleware(mockContext, mockNext)).resolves.toBeUndefined();
        
        vi.clearAllMocks();
      }
    });

    test('should maintain isolation between requests', async () => {
      // First request
      const user1 = { id: 'user-1', email: 'user1@example.com' };
      mockContext.req.header.mockReturnValue('Bearer token1');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: user1 },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);
      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-1');

      // Reset mocks for second request
      vi.clearAllMocks();
      mockContext = createMockContext();
      mockNext = createMockNext();

      // Second request with different user
      const user2 = { id: 'user-2', email: 'user2@example.com' };
      mockContext.req.header.mockReturnValue('Bearer token2');
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: user2 },
        error: null,
      });

      await authMiddleware(mockContext, mockNext);
      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-2');
    });
  });
});