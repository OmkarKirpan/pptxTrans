import { SignJWT, jwtVerify } from 'jose';
import { createLogger } from './logger';
import { AppError } from '../middleware/error-handler';

const logger = createLogger('token');

// JWT secret key
const secretKey = process.env.JWT_SECRET_KEY;
if (!secretKey) {
  logger.error('JWT secret key not provided');
  throw new Error('JWT secret key must be provided');
}

// Create encoder
const encoder = new TextEncoder();
const keyBuffer = encoder.encode(secretKey);

export interface TokenPayload {
  sessionId: string;
  shareId: string;
  permissions: {
    read: boolean;
    comment: boolean;
    edit: boolean;
  };
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for sharing
 */
export async function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn?: number): Promise<string> {
  try {
    // Default expiry to 30 days if not specified
    const expiry = expiresIn || 60 * 60 * 24 * 30; 
    
    const jwt = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiry)
      .sign(keyBuffer);
    
    return jwt;
  } catch (error) {
    logger.error({ error }, 'Error generating token');
    throw new AppError('Error generating token', 500);
  }
}

/**
 * Verify a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, keyBuffer, {
      algorithms: ['HS256'],
    });
    
    return payload as unknown as TokenPayload;
  } catch (error: any) {
    logger.error({ error }, 'Error verifying token');
    
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new AppError('Token expired', 401);
    }
    
    throw new AppError('Invalid token', 401);
  }
} 