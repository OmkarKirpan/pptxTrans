import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createShareHandler,
  listSharesHandler,
  revokeShareHandler,
  validateShareTokenHandler,
} from '../../../src/controllers/shareController';
import { createAuthenticatedContext, createMockContext } from '../../helpers/testHelpers';
import { createMockSupabaseClient, mockDbSuccess, mockDbError } from '../../mocks/supabase';
import {
  validCreateShareRequest,
  shareRecordFixture,
  sessionFixture,
  userFixture,
  validJwtPayload,
} from '../../fixtures/shareData';
import { SharePermission } from '../../../src/models/share';
import { HTTPException } from 'hono/http-exception';

// Mock the repository functions
vi.mock('../../../src/db/shareRepository', () => ({
  createShare: vi.fn(),
  listSharesBySessionId: vi.fn(),
  revokeShareByJti: vi.fn(),
  findActiveShareByJti: vi.fn(),
  getSessionByIdAndOwner: vi.fn(),
}));

// Mock JWT utilities
vi.mock('../../../src/utils/jwt', () => ({
  generateShareToken: vi.fn(),
  verifyShareToken: vi.fn(),
}));

describe('Share Controller', () => {
  let mockSupabase: any;
  let mockRepository: any;
  let mockJwt: any;

  beforeEach(() => {
    // Set up environment
    process.env.APP_BASE_URL = 'http://localhost:3000';

    // Import mocked modules
    mockRepository = require('../../../src/db/shareRepository');
    mockJwt = require('../../../src/utils/jwt');

    // Set up mock Supabase client
    const mock = createMockSupabaseClient();
    mockSupabase = mock.supabase;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createShareHandler', () => {
    test('should create share successfully with valid data', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');
      context.req.valid.mockReturnValue(validCreateShareRequest);
      context.get.mockImplementation((key: string) => {
        if (key === 'supabase') return mockSupabase;
        if (key === 'userId') return 'user-123';
        return undefined;
      });

      // Mock dependencies
      mockRepository.getSessionByIdAndOwner.mockResolvedValue(sessionFixture);
      mockJwt.generateShareToken.mockResolvedValue('mock-jwt-token');
      mockJwt.verifyShareToken.mockResolvedValue({
        ...validJwtPayload,
        jti: 'mock-jti',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });
      mockRepository.createShare.mockResolvedValue(shareRecordFixture);

      // Execute the handlers (array destructuring)
      const [handler] = createShareHandler;
      await handler(context);

      expect(mockRepository.getSessionByIdAndOwner).toHaveBeenCalledWith(
        mockSupabase,
        'session-123',
        'user-123'
      );
      expect(mockJwt.generateShareToken).toHaveBeenCalledWith(
        'session-123',
        validCreateShareRequest.permissions,
        validCreateShareRequest.expiresIn
      );
      expect(mockRepository.createShare).toHaveBeenCalled();
      expect(context.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: shareRecordFixture.id,
          share_token_jti: shareRecordFixture.share_token_jti,
          share_url: expect.stringContaining('http://localhost:3000/shared/'),
          permissions: shareRecordFixture.permissions,
        }),
        201
      );
    });

    test('should throw 400 when session ID is missing', async () => {
      const context = createAuthenticatedContext('user-123');
      context.req.param.mockReturnValue(undefined); // No sessionId

      try {
        const [handler] = createShareHandler;
        await handler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
      }
    });

    test('should throw 404 when session not found', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');
      context.req.valid.mockReturnValue(validCreateShareRequest);

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null);

      try {
        const [handler] = createShareHandler;
        await handler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
      }
    });

    test('should throw 404 when user is not session owner', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');
      context.req.valid.mockReturnValue(validCreateShareRequest);

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null); // User doesn't own session

      try {
        const [handler] = createShareHandler;
        await handler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
      }
    });

    test('should throw 401 when user is not authenticated', async () => {
      const context = createMockContext();
      context.get.mockImplementation((key: string) => {
        if (key === 'userId') return undefined; // Not authenticated
        return undefined;
      });

      try {
        const [handler] = createShareHandler;
        await handler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }
    });

    test('should throw 500 when JWT generation fails', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');
      context.req.valid.mockReturnValue(validCreateShareRequest);

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(sessionFixture);
      mockJwt.generateShareToken.mockRejectedValue(new Error('JWT generation failed'));

      try {
        const [handler] = createShareHandler;
        await handler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('JWT generation failed');
      }
    });

    test('should handle multiple permissions correctly', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');
      const multiPermRequest = {
        permissions: [SharePermission.VIEW, SharePermission.COMMENT],
        expiresIn: '24h',
        name: 'Multi-permission share',
      };
      context.req.valid.mockReturnValue(multiPermRequest);

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(sessionFixture);
      mockJwt.generateShareToken.mockResolvedValue('mock-jwt-token');
      mockJwt.verifyShareToken.mockResolvedValue({
        ...validJwtPayload,
        permissions: [SharePermission.VIEW, SharePermission.COMMENT],
        jti: 'mock-jti',
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      });
      mockRepository.createShare.mockResolvedValue({
        ...shareRecordFixture,
        permissions: [SharePermission.VIEW, SharePermission.COMMENT],
      });

      const [handler] = createShareHandler;
      await handler(context);

      expect(mockJwt.generateShareToken).toHaveBeenCalledWith(
        'session-123',
        [SharePermission.VIEW, SharePermission.COMMENT],
        '24h'
      );
    });
  });

  describe('listSharesHandler', () => {
    test('should list shares for session owner', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');
      const mockShares = [shareRecordFixture];

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(sessionFixture);
      mockRepository.listSharesBySessionId.mockResolvedValue(mockShares);

      await listSharesHandler(context);

      expect(mockRepository.getSessionByIdAndOwner).toHaveBeenCalledWith(
        mockSupabase,
        'session-123',
        'user-123'
      );
      expect(mockRepository.listSharesBySessionId).toHaveBeenCalledWith(
        mockSupabase,
        'session-123',
        'user-123'
      );
      expect(context.json).toHaveBeenCalledWith(mockShares);
    });

    test('should return empty array when no shares exist', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(sessionFixture);
      mockRepository.listSharesBySessionId.mockResolvedValue([]);

      await listSharesHandler(context);

      expect(context.json).toHaveBeenCalledWith([]);
    });

    test('should throw 400 when session ID is missing', async () => {
      const context = createAuthenticatedContext('user-123');
      context.req.param.mockReturnValue(undefined); // No sessionId

      try {
        await listSharesHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
      }
    });

    test('should throw 404 when session not found', async () => {
      const context = createAuthenticatedContext('user-123', 'session-123');

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(null);

      try {
        await listSharesHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
      }
    });
  });

  describe('revokeShareHandler', () => {
    test('should revoke share successfully', async () => {
      const context = createAuthenticatedContext('user-123');
      context.req.param.mockReturnValue('jti-123');

      const revokedShare = {
        ...shareRecordFixture,
        revoked_at: new Date().toISOString(),
      };

      mockRepository.revokeShareByJti.mockResolvedValue(revokedShare);

      await revokeShareHandler(context);

      expect(mockRepository.revokeShareByJti).toHaveBeenCalledWith(
        mockSupabase,
        'jti-123',
        'user-123'
      );
      expect(context.json).toHaveBeenCalledWith({
        message: 'Share token revoked successfully.',
        data: revokedShare,
      });
    });

    test('should throw 400 when JTI is missing', async () => {
      const context = createAuthenticatedContext('user-123');
      context.req.param.mockReturnValue(undefined); // No JTI

      try {
        await revokeShareHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
      }
    });

    test('should throw 404 when share not found', async () => {
      const context = createAuthenticatedContext('user-123');
      context.req.param.mockReturnValue('jti-123');

      mockRepository.revokeShareByJti.mockRejectedValue(new Error('Share not found'));

      try {
        await revokeShareHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
      }
    });

    test('should throw 500 for database errors', async () => {
      const context = createAuthenticatedContext('user-123');
      context.req.param.mockReturnValue('jti-123');

      mockRepository.revokeShareByJti.mockRejectedValue(new Error('Database connection failed'));

      try {
        await revokeShareHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
      }
    });
  });

  describe('validateShareTokenHandler', () => {
    test('should validate token successfully', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue('valid-jwt-token');
      context.get.mockReturnValue(mockSupabase);

      mockJwt.verifyShareToken.mockResolvedValue(validJwtPayload);
      mockRepository.findActiveShareByJti.mockResolvedValue(shareRecordFixture);

      await validateShareTokenHandler(context);

      expect(mockJwt.verifyShareToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockRepository.findActiveShareByJti).toHaveBeenCalledWith(
        mockSupabase,
        validJwtPayload.jti
      );
      expect(context.json).toHaveBeenCalledWith({
        valid: true,
        payload: shareRecordFixture,
      });
    });

    test('should throw 400 when token is missing', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue(undefined); // No token

      try {
        await validateShareTokenHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
      }
    });

    test('should throw 401 for invalid JWT', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue('invalid-jwt');
      context.get.mockReturnValue(mockSupabase);

      mockJwt.verifyShareToken.mockRejectedValue(new Error('Invalid JWT'));

      try {
        await validateShareTokenHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }
    });

    test('should throw 400 when JTI is missing from token', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue('token-without-jti');
      context.get.mockReturnValue(mockSupabase);

      mockJwt.verifyShareToken.mockResolvedValue({
        ...validJwtPayload,
        jti: undefined, // Missing JTI
      });

      try {
        await validateShareTokenHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
      }
    });

    test('should throw 401 when share record not found', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue('valid-jwt-token');
      context.get.mockReturnValue(mockSupabase);

      mockJwt.verifyShareToken.mockResolvedValue(validJwtPayload);
      mockRepository.findActiveShareByJti.mockResolvedValue(null); // Share not found

      try {
        await validateShareTokenHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }
    });

    test('should throw 401 when permissions mismatch', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue('valid-jwt-token');
      context.get.mockReturnValue(mockSupabase);

      mockJwt.verifyShareToken.mockResolvedValue({
        ...validJwtPayload,
        permissions: [SharePermission.VIEW],
      });
      mockRepository.findActiveShareByJti.mockResolvedValue({
        ...shareRecordFixture,
        permissions: [SharePermission.COMMENT], // Different permissions
      });

      try {
        await validateShareTokenHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }
    });

    test('should handle permissions in different order', async () => {
      const context = createMockContext();
      context.req.param.mockReturnValue('valid-jwt-token');
      context.get.mockReturnValue(mockSupabase);

      mockJwt.verifyShareToken.mockResolvedValue({
        ...validJwtPayload,
        permissions: [SharePermission.COMMENT, SharePermission.VIEW], // Different order
      });
      mockRepository.findActiveShareByJti.mockResolvedValue({
        ...shareRecordFixture,
        permissions: [SharePermission.VIEW, SharePermission.COMMENT], // Same permissions, different order
      });

      await validateShareTokenHandler(context);

      expect(context.json).toHaveBeenCalledWith({
        valid: true,
        payload: expect.objectContaining({
          permissions: [SharePermission.VIEW, SharePermission.COMMENT],
        }),
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle Supabase client not available', async () => {
      const context = createMockContext();
      context.get.mockReturnValue(undefined); // No Supabase client

      try {
        await listSharesHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
      }
    });

    test('should handle missing user authentication', async () => {
      const context = createMockContext();
      context.get.mockImplementation((key: string) => {
        if (key === 'supabase') return mockSupabase;
        if (key === 'userId') return undefined; // Not authenticated
        return undefined;
      });

      try {
        await listSharesHandler(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete share lifecycle', async () => {
      // 1. Create share
      const createContext = createAuthenticatedContext('user-123', 'session-123');
      createContext.req.valid.mockReturnValue(validCreateShareRequest);

      mockRepository.getSessionByIdAndOwner.mockResolvedValue(sessionFixture);
      mockJwt.generateShareToken.mockResolvedValue('test-jwt-token');
      mockJwt.verifyShareToken.mockResolvedValue(validJwtPayload);
      mockRepository.createShare.mockResolvedValue(shareRecordFixture);

      const [createHandler] = createShareHandler;
      await createHandler(createContext);

      // 2. List shares
      const listContext = createAuthenticatedContext('user-123', 'session-123');
      mockRepository.listSharesBySessionId.mockResolvedValue([shareRecordFixture]);

      await listSharesHandler(listContext);

      // 3. Validate share
      const validateContext = createMockContext();
      validateContext.req.param.mockReturnValue('test-jwt-token');
      validateContext.get.mockReturnValue(mockSupabase);

      mockRepository.findActiveShareByJti.mockResolvedValue(shareRecordFixture);

      await validateShareTokenHandler(validateContext);

      // 4. Revoke share
      const revokeContext = createAuthenticatedContext('user-123');
      revokeContext.req.param.mockReturnValue(validJwtPayload.jti);

      mockRepository.revokeShareByJti.mockResolvedValue({
        ...shareRecordFixture,
        revoked_at: new Date().toISOString(),
      });

      await revokeShareHandler(revokeContext);

      // Verify all operations were called
      expect(mockRepository.createShare).toHaveBeenCalled();
      expect(mockRepository.listSharesBySessionId).toHaveBeenCalled();
      expect(mockRepository.findActiveShareByJti).toHaveBeenCalled();
      expect(mockRepository.revokeShareByJti).toHaveBeenCalled();
    });
  });
});