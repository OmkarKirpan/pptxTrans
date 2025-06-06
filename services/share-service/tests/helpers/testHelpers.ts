import type { Context } from 'hono';
import { vi } from 'vitest';

// Create mock Hono context
export function createMockContext(overrides: Record<string, unknown> = {}): Context {
  const mockRequest = {
    param: vi.fn(),
    header: vi.fn(),
    valid: vi.fn(),
    json: vi.fn(),
    ...overrides.req,
  };

  const mockResponse = {
    json: vi.fn(),
    status: vi.fn(),
    ...overrides.res,
  };

  const context = {
    req: mockRequest,
    res: mockResponse,
    get: vi.fn(),
    set: vi.fn(),
    json: vi.fn().mockReturnValue({ json: mockResponse }),
    status: vi.fn(),
    ...overrides,
  } as any;

  // Chain methods properly
  context.json.mockReturnValue(context);
  context.status.mockReturnValue(context);

  return context;
}

// Create authenticated context
export function createAuthenticatedContext(userId: string, sessionId?: string, overrides: Record<string, unknown> = {}): Context {
  const context = createMockContext(overrides);
  
  context.get.mockImplementation((key: string) => {
    switch (key) {
      case 'userId':
        return userId;
      case 'userEmail':
        return 'test@example.com';
      case 'supabase':
        return overrides.supabase || createMockSupabaseClient();
      default:
        return undefined;
    }
  });

  if (sessionId) {
    context.req.param.mockImplementation((key: string) => {
      if (key === 'sessionId') return sessionId;
      return overrides.params?.[key];
    });
  }

  return context;
}

// Create mock Supabase client for context
function createMockSupabaseClient() {
  return {
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
    auth: {
      getUser: vi.fn(),
    },
  };
}

// Mock next function for middleware testing
export const createMockNext = () => vi.fn().mockResolvedValue(undefined);

// Assert error response format
export function assertErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
  expect(response.status).toBe(expectedStatus);
  if (expectedMessage) {
    expect(response.error || response.message).toContain(expectedMessage);
  }
}

// Assert success response format
export function assertSuccessResponse(response: any, expectedStatus: number = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.error).toBeUndefined();
}

// Generate test JWT token
export async function generateTestJWT(payload: Record<string, unknown>, secret = 'test-secret') {
  const jose = await import('jose');
  const secretKey = new TextEncoder().encode(secret);
  
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('ShareService')
    .setAudience('PptxTranslatorApp')
    .setJti(payload.jti || 'test-jti')
    .setExpirationTime(payload.exp || '7d')
    .sign(secretKey);
}

// Wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Clean up test environment
export function resetAllMocks() {
  vi.clearAllMocks();
  vi.resetAllMocks();
}

// Database test helpers
export function expectDatabaseCall(mockFn: ReturnType<typeof vi.fn>, tableName: string, operation: string) {
  expect(mockFn).toHaveBeenCalledWith(tableName);
  return mockFn.mock.results[mockFn.mock.calls.length - 1]?.value?.[operation] || mockFn;
}

// Validation helpers
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidISO8601(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime()) && date.toISOString() === dateString;
}