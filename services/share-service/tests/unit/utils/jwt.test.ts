import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { SharePermission } from '../../../src/models/share';
import * as jose from 'jose';

// Setup test environment
beforeAll(() => {
  process.env.SHARE_TOKEN_SECRET = 'test-secret-key-for-jwt-testing-only-12345678901234567890';
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  process.env.SHARE_TOKEN_SECRET = 'test-secret-key-for-jwt-testing-only-12345678901234567890';
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('JWT Utilities', () => {
  // Import the module after environment is set up
  let generateShareToken: any;
  let verifyShareToken: any;

  beforeAll(async () => {
    const jwtModule = await import('../../../src/utils/jwt');
    generateShareToken = jwtModule.generateShareToken;
    verifyShareToken = jwtModule.verifyShareToken;
  });
  describe('generateShareToken', () => {
    test('should generate valid JWT with required claims', async () => {
      const sessionId = 'test-session-123';
      const permissions = [SharePermission.VIEW];
      const expiresIn = '7d';

      const token = await generateShareToken(sessionId, permissions, expiresIn);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify the token can be decoded
      const payload = await verifyShareToken(token);
      expect(payload.sessionId).toBe(sessionId);
      expect(payload.permissions).toEqual(permissions);
      expect(payload.iss).toBe('ShareService');
      expect(payload.aud).toBe('PptxTranslatorApp');
      expect(payload.jti).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    test('should generate unique JTI for each token', async () => {
      const sessionId = 'test-session-123';
      const permissions = [SharePermission.VIEW];

      const token1 = await generateShareToken(sessionId, permissions);
      const token2 = await generateShareToken(sessionId, permissions);

      const payload1 = await verifyShareToken(token1);
      const payload2 = await verifyShareToken(token2);

      expect(payload1.jti).not.toBe(payload2.jti);
    });

    test('should handle different expiry formats', async () => {
      const sessionId = 'test-session-123';
      const permissions = [SharePermission.VIEW];

      // Test string format
      const token7d = await generateShareToken(sessionId, permissions, '7d');
      const token1h = await generateShareToken(sessionId, permissions, '1h');
      const token30m = await generateShareToken(sessionId, permissions, '30m');

      // Verify all tokens are valid
      const payload7d = await verifyShareToken(token7d);
      const payload1h = await verifyShareToken(token1h);
      const payload30m = await verifyShareToken(token30m);

      expect(payload7d.exp).toBeGreaterThan(payload1h.exp!);
      expect(payload1h.exp).toBeGreaterThan(payload30m.exp!);
    });

    test('should include multiple permissions in payload', async () => {
      const sessionId = 'test-session-123';
      const permissions = [SharePermission.VIEW, SharePermission.COMMENT];

      const token = await generateShareToken(sessionId, permissions);
      const payload = await verifyShareToken(token);

      expect(payload.permissions).toEqual(permissions);
      expect(payload.permissions).toHaveLength(2);
    });

    test('should set correct issuer and audience', async () => {
      const sessionId = 'test-session-123';
      const permissions = [SharePermission.VIEW];

      const token = await generateShareToken(sessionId, permissions);
      const payload = await verifyShareToken(token);

      expect(payload.iss).toBe('ShareService');
      expect(payload.aud).toBe('PptxTranslatorApp');
    });

    test('should throw error when SHARE_TOKEN_SECRET is missing', async () => {
      delete process.env.SHARE_TOKEN_SECRET;

      // Re-import to trigger the environment check
      await expect(async () => {
        const { generateShareToken: newGenerateShareToken } = await import('../../../src/utils/jwt');
        return newGenerateShareToken('session', [SharePermission.VIEW]);
      }).rejects.toThrow('SHARE_TOKEN_SECRET environment variable is not set');

      // Restore for other tests
      process.env.SHARE_TOKEN_SECRET = 'test-secret-key-for-jwt-testing-only-12345678901234567890';
    });

    test('should handle invalid expiry format gracefully', async () => {
      const sessionId = 'test-session-123';
      const permissions = [SharePermission.VIEW];

      // jose should handle invalid expiry format
      await expect(
        generateShareToken(sessionId, permissions, 'invalid-time-format')
      ).rejects.toThrow();
    });
  });

  describe('verifyShareToken', () => {
    let validToken: string;

    beforeEach(async () => {
      validToken = await generateShareToken('test-session-123', [SharePermission.VIEW], '1h');
    });

    test('should verify valid token and extract payload', async () => {
      const payload = await verifyShareToken(validToken);

      expect(payload.sessionId).toBe('test-session-123');
      expect(payload.permissions).toEqual([SharePermission.VIEW]);
      expect(payload.iss).toBe('ShareService');
      expect(payload.aud).toBe('PptxTranslatorApp');
      expect(payload.jti).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    test('should verify issuer and audience claims', async () => {
      const payload = await verifyShareToken(validToken);

      expect(payload.iss).toBe('ShareService');
      expect(payload.aud).toBe('PptxTranslatorApp');
    });

    test('should throw error for expired token', async () => {
      // Create an expired token
      const expiredToken = await generateShareToken(
        'test-session-123',
        [SharePermission.VIEW],
        '-1s' // Already expired
      );

      // Wait a bit to ensure expiry
      await new Promise(resolve => setTimeout(resolve, 1100));

      await expect(verifyShareToken(expiredToken)).rejects.toThrow('Share token has expired');
    });

    test('should throw error for invalid signature', async () => {
      const tamperedToken = validToken.slice(0, -1) + 'x'; // Tamper with signature

      await expect(verifyShareToken(tamperedToken)).rejects.toThrow('Invalid share token signature');
    });

    test('should throw error for malformed JWT', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      await expect(verifyShareToken(malformedToken)).rejects.toThrow();
    });

    test('should throw error for wrong issuer', async () => {
      // Create token with wrong issuer
      const secretKey = new TextEncoder().encode(process.env.SHARE_TOKEN_SECRET!);
      const wrongIssuerToken = await new jose.SignJWT({
        sessionId: 'test-session',
        permissions: [SharePermission.VIEW],
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('WrongIssuer') // Wrong issuer
        .setAudience('PptxTranslatorApp')
        .setJti('test-jti')
        .setExpirationTime('1h')
        .sign(secretKey);

      await expect(verifyShareToken(wrongIssuerToken)).rejects.toThrow('Share token claim validation failed');
    });

    test('should throw error for wrong audience', async () => {
      // Create token with wrong audience
      const secretKey = new TextEncoder().encode(process.env.SHARE_TOKEN_SECRET!);
      const wrongAudienceToken = await new jose.SignJWT({
        sessionId: 'test-session',
        permissions: [SharePermission.VIEW],
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('ShareService')
        .setAudience('WrongAudience') // Wrong audience
        .setJti('test-jti')
        .setExpirationTime('1h')
        .sign(secretKey);

      await expect(verifyShareToken(wrongAudienceToken)).rejects.toThrow('Share token claim validation failed');
    });

    test('should throw error for missing required claims', async () => {
      // Create token without required claims
      const secretKey = new TextEncoder().encode(process.env.SHARE_TOKEN_SECRET!);
      const incompleteToken = await new jose.SignJWT({
        // Missing sessionId and permissions
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('ShareService')
        .setAudience('PptxTranslatorApp')
        .setJti('test-jti')
        .setExpirationTime('1h')
        .sign(secretKey);

      const payload = await verifyShareToken(incompleteToken);
      
      // The token should verify but payload should be incomplete
      expect(payload.sessionId).toBeUndefined();
      expect(payload.permissions).toBeUndefined();
    });

    test('should handle JWSInvalid error', async () => {
      const invalidJWS = 'invalid.jws.structure';

      await expect(verifyShareToken(invalidJWS)).rejects.toThrow('Invalid JWS structure');
    });

    test('should handle generic JOSE errors', async () => {
      // Test with completely invalid input
      const invalidInput = 'completely-invalid-input';

      await expect(verifyShareToken(invalidInput)).rejects.toThrow();
    });
  });

  describe('Token Integration', () => {
    test('should maintain data integrity through generate/verify cycle', async () => {
      const originalData = {
        sessionId: 'session-with-special-chars-123!@#',
        permissions: [SharePermission.VIEW, SharePermission.COMMENT],
      };

      const token = await generateShareToken(originalData.sessionId, originalData.permissions, '24h');
      const verifiedData = await verifyShareToken(token);

      expect(verifiedData.sessionId).toBe(originalData.sessionId);
      expect(verifiedData.permissions).toEqual(originalData.permissions);
    });

    test('should generate different tokens for same input called multiple times', async () => {
      const sessionId = 'test-session';
      const permissions = [SharePermission.VIEW];

      const tokens = await Promise.all([
        generateShareToken(sessionId, permissions),
        generateShareToken(sessionId, permissions),
        generateShareToken(sessionId, permissions),
      ]);

      // All tokens should be different due to different JTIs and iat values
      expect(new Set(tokens)).toHaveProperty('size', 3);
    });

    test('should handle edge case permission arrays', async () => {
      const sessionId = 'test-session';

      // Test with single permission
      const singlePermToken = await generateShareToken(sessionId, [SharePermission.VIEW]);
      const singlePermPayload = await verifyShareToken(singlePermToken);
      expect(singlePermPayload.permissions).toEqual([SharePermission.VIEW]);

      // Test with multiple permissions
      const multiPermToken = await generateShareToken(sessionId, [SharePermission.VIEW, SharePermission.COMMENT]);
      const multiPermPayload = await verifyShareToken(multiPermToken);
      expect(multiPermPayload.permissions).toEqual([SharePermission.VIEW, SharePermission.COMMENT]);
    });
  });
});