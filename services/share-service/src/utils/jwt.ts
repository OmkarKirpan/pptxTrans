import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid'; // For JTI

export interface ShareTokenPayload extends jose.JWTPayload {
  sessionId: string;
  permissions: string[];
  // 'sub' (subject) can be used for the share record ID if needed later
  // 'jti' (JWT ID) will be automatically generated
}

const SHARE_TOKEN_SECRET = process.env.SHARE_TOKEN_SECRET;
const ISSUER = 'ShareService';
const AUDIENCE = 'PptxTranslatorApp';

if (!SHARE_TOKEN_SECRET) {
  // In a real app, consider a more robust way to handle this at startup
  // For now, logging and throwing an error is sufficient for development
  console.error('FATAL: SHARE_TOKEN_SECRET environment variable is not set.');
  throw new Error('SHARE_TOKEN_SECRET environment variable is not set.');
}

const secretKey = new TextEncoder().encode(SHARE_TOKEN_SECRET);

/**
 * Generates a JWT share token.
 * @param sessionId The ID of the session being shared.
 * @param permissions An array of permission strings.
 * @param expiresIn A string like '1h', '7d', or a number of seconds.
 * @returns The generated JWT string.
 */
export async function generateShareToken(
  sessionId: string,
  permissions: string[],
  expiresIn: string | number = '7d' // Default to 7 days
): Promise<string> {
  try {
    const payload: ShareTokenPayload = {
      sessionId,
      permissions,
    };

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setJti(uuidv4()) // Generate a unique JTI
      .setExpirationTime(expiresIn)
      .sign(secretKey);

    return token;
  } catch (error) {
    console.error('Error generating share token:', error);
    // It's generally better to throw a custom error or a more generic one
    // to avoid leaking implementation details if this error bubbles up to users.
    throw new Error('Failed to generate share token.');
  }
}

/**
 * Verifies a JWT share token.
 * @param token The JWT string to verify.
 * @returns The decoded payload if verification is successful.
 * @throws Error if verification fails (e.g., expired, invalid signature, malformed).
 */
export async function verifyShareToken(
  token: string
): Promise<ShareTokenPayload> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload as ShareTokenPayload;
  } catch (error) {
    console.error('Error verifying share token:', error);
    if (error instanceof jose.errors.JWTExpired) {
      throw new Error('Share token has expired.');
    } else if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      throw new Error('Invalid share token signature.');
    } else if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new Error('Share token claim validation failed.');
    } else if (error instanceof jose.errors.JWSInvalid) { // If the JWS is invalid for other reasons
      throw new Error('Invalid JWS structure.');
    } else if (error instanceof jose.errors.JOSEError) { // Generic JOSE error
      throw new Error('Invalid share token (JOSEError).');
    }
    throw new Error('Failed to verify share token due to an unexpected error.');
  }
} 