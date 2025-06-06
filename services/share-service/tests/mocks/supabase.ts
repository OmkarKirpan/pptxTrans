import { vi } from 'vitest';
import type { ShareRecord } from '../../src/models/share';
import { SharePermission } from '../../src/models/share';

// Mock Supabase client
export const createMockSupabaseClient = () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockEq = vi.fn();
  const mockIs = vi.fn();
  const mockOrder = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();

  // Chain methods for query builder
  mockSelect.mockReturnValue({
    eq: mockEq,
    is: mockIs,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  });

  mockInsert.mockReturnValue({
    select: () => ({
      single: mockSingle,
    }),
  });

  mockUpdate.mockReturnValue({
    eq: mockEq,
    is: mockIs,
    select: () => ({
      single: mockSingle,
    }),
  });

  mockEq.mockReturnValue({
    eq: mockEq,
    is: mockIs,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    select: () => ({
      single: mockSingle,
    }),
  });

  mockIs.mockReturnValue({
    eq: mockEq,
    is: mockIs,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  });

  mockOrder.mockReturnValue({
    eq: mockEq,
    is: mockIs,
  });

  const mockAuth = {
    getUser: vi.fn(),
  };

  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }),
    auth: mockAuth,
  };

  return {
    supabase: mockSupabase,
    mocks: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      auth: mockAuth,
    },
  };
};

// Mock successful auth response
export const mockAuthSuccess = (userId: string, email?: string) => ({
  data: {
    user: {
      id: userId,
      email: email || 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    },
  },
  error: null,
});

// Mock auth error response
export const mockAuthError = (message: string) => ({
  data: { user: null },
  error: { message },
});

// Mock database responses
export const mockShareRecord = (overrides: Partial<ShareRecord> = {}): ShareRecord => ({
  id: 'share-id-123',
  session_id: 'session-id-123',
  share_token_jti: 'jti-123',
  permissions: [SharePermission.VIEW],
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_by: 'user-id-123',
  created_at: new Date().toISOString(),
  revoked_at: null,
  name: 'Test Share',
  share_url: 'http://localhost:3000/shared/test-token',
  ...overrides,
});

export const mockSessionRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-id-123',
  user_id: 'user-id-123',
  ...overrides,
});

// Mock database success responses
export const mockDbSuccess = (data: unknown) => ({
  data,
  error: null,
});

// Mock database error responses
export const mockDbError = (message: string, code?: string) => ({
  data: null,
  error: { message, code },
});