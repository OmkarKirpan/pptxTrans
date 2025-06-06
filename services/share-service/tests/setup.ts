import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Test environment setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key';
  process.env.SHARE_TOKEN_SECRET = process.env.TEST_SHARE_TOKEN_SECRET || 'test-secret-key-for-jwt-testing-only';
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.PORT = '3001';
});

afterAll(async () => {
  // Clean up test environment
});

beforeEach(async () => {
  // Reset any global state before each test
});

afterEach(async () => {
  // Clean up after each test
});

// Test database helper
export function createTestSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_ANON_KEY || 'test-anon-key'
  );
}

// Test constants
export const TEST_CONSTANTS = {
  VALID_SESSION_ID: 'b8f7e7c4-1234-4567-8901-123456789012',
  VALID_USER_ID: 'a1b2c3d4-1234-4567-8901-123456789012',
  VALID_JTI: 'c9e8f7d6-1234-4567-8901-123456789012',
  TEST_EMAIL: 'test@example.com',
  INVALID_UUID: 'not-a-uuid',
  EXPIRED_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid',
};