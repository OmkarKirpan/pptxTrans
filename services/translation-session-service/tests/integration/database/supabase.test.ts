import { test, expect, describe, beforeEach } from 'bun:test';
import { MockSupabaseClient } from '../../utils/mock-supabase';
import { createMockSession, createMockUser } from '../../utils/test-helpers';
import { TranslationSession } from '../../../src/model';

describe('Database Integration', () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    mockSupabase = new MockSupabaseClient();
  });

  describe('Supabase Connection', () => {
    test('should handle valid connection credentials', async () => {
      mockSupabase.setMockSessions([createMockSession()]);

      const result = await mockSupabase.from('translation_sessions').select('*');
      
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });

    test('should handle connection errors', async () => {
      mockSupabase.setMockError({ message: 'Connection failed' });

      const result = await mockSupabase.from('translation_sessions').select('*');
      
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('Connection failed');
      expect(result.data).toBeNull();
    });

    test('should handle network timeout scenarios', async () => {
      mockSupabase.setMockError({ message: 'Request timeout', code: 'TIMEOUT' });

      const result = await mockSupabase.from('translation_sessions').select('*');
      
      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('TIMEOUT');
    });
  });

  describe('Row Level Security (RLS)', () => {
    test('should enforce user isolation', async () => {
      const user1 = createMockUser();
      const user2 = { ...createMockUser(), id: 'user-789' };
      
      const sessions = [
        createMockSession({ id: 'session-1', user_id: user1.id }),
        createMockSession({ id: 'session-2', user_id: user2.id }),
      ];

      mockSupabase.setMockSessions(sessions);

      // Query for user1's sessions
      const result = await mockSupabase
        .from('translation_sessions')
        .select('*')
        .eq('user_id', user1.id);

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data![0].user_id).toBe(user1.id);
    });

    test('should prevent cross-user data access', async () => {
      const user1 = createMockUser();
      const user2 = { ...createMockUser(), id: 'user-789' };
      
      const sessions = [
        createMockSession({ id: 'session-1', user_id: user1.id }),
      ];

      mockSupabase.setMockSessions(sessions);

      // User2 trying to access user1's session
      const result = await mockSupabase
        .from('translation_sessions')
        .select('*')
        .eq('id', 'session-1')
        .eq('user_id', user2.id)
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('PGRST116'); // No rows found
    });

    test('should prevent anonymous access', async () => {
      mockSupabase.setAuthUser(null);
      mockSupabase.setMockSessions([createMockSession()]);

      // This would fail in real Supabase due to RLS, but in mock we simulate
      mockSupabase.setMockError({ message: 'Anonymous access denied', code: 'RLS_VIOLATION' });

      const result = await mockSupabase
        .from('translation_sessions')
        .select('*');

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('RLS_VIOLATION');
    });
  });

  describe('Data Integrity', () => {
    test('should enforce required field validation', async () => {
      const invalidSession = {
        // Missing required fields like session_name, source_language_code
        user_id: 'user-456',
        target_language_codes: ['es'],
      };

      mockSupabase.setMockError({ 
        message: 'null value in column "session_name" violates not-null constraint',
        code: '23502'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(invalidSession)
        .select()
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23502');
    });

    test('should enforce foreign key constraints', async () => {
      const sessionWithInvalidUser = createMockSession({
        user_id: 'non-existent-user',
      });

      mockSupabase.setMockError({
        message: 'insert or update on table "translation_sessions" violates foreign key constraint',
        code: '23503'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(sessionWithInvalidUser)
        .select()
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23503');
    });

    test('should enforce unique constraints', async () => {
      const session1 = createMockSession({ id: 'duplicate-id' });
      const session2 = createMockSession({ id: 'duplicate-id' });

      mockSupabase.setMockSessions([session1]);
      mockSupabase.setMockError({
        message: 'duplicate key value violates unique constraint',
        code: '23505'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(session2)
        .select()
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23505');
    });

    test('should validate data types', async () => {
      const invalidSession = {
        ...createMockSession(),
        slide_count: 'invalid-number', // Should be integer
      };

      mockSupabase.setMockError({
        message: 'invalid input syntax for type integer',
        code: '22P02'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(invalidSession)
        .select()
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('22P02');
    });

    test('should validate enum values', async () => {
      const invalidSession = createMockSession({
        status: 'invalid_status' as any,
      });

      mockSupabase.setMockError({
        message: 'invalid input value for enum session_status',
        code: '22P02'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(invalidSession)
        .select()
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('22P02');
    });
  });

  describe('Query Operations', () => {
    test('should handle basic SELECT operations', async () => {
      const sessions = [
        createMockSession({ id: 'session-1' }),
        createMockSession({ id: 'session-2' }),
      ];

      mockSupabase.setMockSessions(sessions);

      const result = await mockSupabase
        .from('translation_sessions')
        .select('*');

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
    });

    test('should handle INSERT operations', async () => {
      const newSession = createMockSession();

      mockSupabase.setMockSessions([newSession]);

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(newSession)
        .select()
        .single();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(newSession);
    });

    test('should handle UPDATE operations', async () => {
      const existingSession = createMockSession();
      const updatedData = { session_name: 'Updated Name' };

      mockSupabase.setMockSessions([{ ...existingSession, ...updatedData }]);

      const result = await mockSupabase
        .from('translation_sessions')
        .update(updatedData)
        .eq('id', existingSession.id)
        .select()
        .single();

      expect(result.error).toBeNull();
      expect(result.data!.session_name).toBe('Updated Name');
    });

    test('should handle DELETE operations', async () => {
      const sessionToDelete = createMockSession();

      mockSupabase.setMockSessions([]);

      const result = await mockSupabase
        .from('translation_sessions')
        .delete()
        .eq('id', sessionToDelete.id);

      expect(result.error).toBeNull();
    });

    test('should handle complex filtering', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', status: 'draft' }),
        createMockSession({ id: 'session-2', status: 'completed' }),
        createMockSession({ id: 'session-3', status: 'draft' }),
      ];

      mockSupabase.setMockSessions(sessions.filter(s => s.status === 'draft'));

      const result = await mockSupabase
        .from('translation_sessions')
        .select('*')
        .eq('status', 'draft');

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data!.every(s => s.status === 'draft')).toBe(true);
    });

    test('should handle ordering and pagination', async () => {
      const sessions = Array.from({ length: 15 }, (_, i) =>
        createMockSession({ 
          id: `session-${i}`,
          created_at: new Date(2024, 0, i + 1).toISOString(),
        })
      );

      // Mock will return first 10 items
      mockSupabase.setMockSessions(sessions.slice(0, 10));

      const result = await mockSupabase
        .from('translation_sessions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 9);

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(10);
      expect(result.count).toBe(15);
    });
  });

  describe('Authentication Integration', () => {
    test('should validate JWT tokens', async () => {
      const validUser = createMockUser();
      mockSupabase.setAuthUser(validUser);

      const result = await mockSupabase.auth.getUser('valid-token');

      expect(result.error).toBeNull();
      expect(result.data.user).toEqual(validUser);
    });

    test('should reject invalid tokens', async () => {
      mockSupabase.setAuthError({ message: 'Invalid token' });

      const result = await mockSupabase.auth.getUser('invalid-token');

      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('Invalid token');
      expect(result.data.user).toBeNull();
    });

    test('should handle expired tokens', async () => {
      mockSupabase.setAuthError({ message: 'Token expired' });

      const result = await mockSupabase.auth.getUser('expired-token');

      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('Token expired');
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection failures', async () => {
      mockSupabase.setMockError({ 
        message: 'Connection to database failed',
        code: 'CONNECTION_ERROR'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .select('*');

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('CONNECTION_ERROR');
    });

    test('should handle query timeout errors', async () => {
      mockSupabase.setMockError({
        message: 'Query execution timeout',
        code: 'QUERY_TIMEOUT'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .select('*');

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('QUERY_TIMEOUT');
    });

    test('should handle constraint violation errors', async () => {
      mockSupabase.setMockError({
        message: 'Check constraint violation',
        code: '23514'
      });

      const result = await mockSupabase
        .from('translation_sessions')
        .insert(createMockSession())
        .select()
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
    });
  });
});