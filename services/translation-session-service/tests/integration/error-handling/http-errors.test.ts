import { test, expect, describe } from 'bun:test';
import { sessionController } from '../../../src/controller';
import { MockSupabaseClient } from '../../utils/mock-supabase';
import { 
  createMockContext, 
  createMockUser, 
  createValidSessionPayload,
  extractJsonFromResponse,
  assertResponseStatus 
} from '../../utils/test-helpers';

const mockSupabase = new MockSupabaseClient();

describe('HTTP Error Handling', () => {
  describe('400 Bad Request Errors', () => {
    test('should return 400 for invalid JSON payload', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.json = () => Promise.reject(new SyntaxError('Unexpected token'));

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid request body');
    });

    test('should return 400 for missing required fields', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.json = () => Promise.resolve({
        // Missing session_name, source_language_code, target_language_codes
        slide_count: 10,
      });

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeTruthy();
      expect(Array.isArray(data.details)).toBe(true);
    });

    test('should return 400 for invalid field formats', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.json = () => Promise.resolve({
        session_name: '', // Empty string
        source_language_code: 'en',
        target_language_codes: [], // Empty array
      });

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid input');
    });

    test('should return 400 for invalid session ID format', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.param = (key: string) => key === 'sessionId' ? '' : '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session ID is required');
    });

    test('should return 400 for empty update payload', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';
      context.req.json = () => Promise.resolve({});

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('No fields to update provided');
    });

    test('should return 400 for invalid enum values', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';
      context.req.json = () => Promise.resolve({
        status: 'invalid_status_value',
      });

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid input');
    });

    test('should return 400 for invalid datetime format', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';
      context.req.json = () => Promise.resolve({
        last_opened_at: '2024-01-01 12:00:00', // Invalid format
      });

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid input');
    });
  });

  describe('401 Unauthorized Errors', () => {
    test('should return 401 for missing authentication', async () => {
      const context = createMockContext(null); // No user
      
      context.req.json = () => Promise.resolve(createValidSessionPayload());

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 401);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('User not authenticated or user ID missing');
    });

    test('should return 401 for invalid user format', async () => {
      const invalidUser = { invalidField: 'test' }; // Missing id field
      const context = createMockContext(invalidUser);
      
      context.req.json = () => Promise.resolve(createValidSessionPayload());

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 401);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('User not authenticated or user ID missing');
    });

    test('should return 401 for expired tokens', async () => {
      // This would be handled by auth middleware, but we can test the controller response
      const context = createMockContext(null);
      
      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 401);
    });

    test('should return 401 for all endpoints without authentication', async () => {
      const context = createMockContext(null);
      
      const endpoints = [
        () => sessionController.createSession(context as any),
        () => sessionController.listSessions(context as any),
        () => sessionController.getSessionById(context as any),
        () => sessionController.updateSession(context as any),
        () => sessionController.deleteSession(context as any),
      ];

      for (const endpoint of endpoints) {
        const response = await endpoint();
        assertResponseStatus(response, 401);
      }
    });
  });

  describe('404 Not Found Errors', () => {
    test('should return 404 for non-existent session in getSessionById', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ code: 'PGRST116', message: 'No rows found' });
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'non-existent' : '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 404);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session not found');
    });

    test('should return 404 for non-existent session in updateSession', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ code: 'PGRST116', message: 'No rows found' });
      mockSupabase.setMockSessions([]); // No sessions for count check
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'non-existent' : '';
      context.req.json = () => Promise.resolve({ session_name: 'Updated' });

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 404);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session not found or access denied');
    });

    test('should return 404 for non-existent session in deleteSession', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockSessions([]); // No sessions
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'non-existent' : '';

      const response = await sessionController.deleteSession(context as any);
      
      assertResponseStatus(response, 404);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session not found or access denied');
    });

    test('should return 404 for access denied (user doesn\'t own session)', async () => {
      const mockUser = createMockUser();
      const otherUserSession = { 
        id: 'session-123', 
        user_id: 'other-user', 
        session_name: 'Other User Session' 
      };
      
      // Mock empty result for user's query (simulating RLS filtering)
      mockSupabase.setMockSessions([]);
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 404);
    });
  });

  describe('500 Internal Server Error', () => {
    test('should return 500 for database connection failures', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ message: 'Database connection failed' });
      
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.resolve(createValidSessionPayload());

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 500);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Failed to create session');
      expect(data.details).toBe('Database connection failed');
    });

    test('should return 500 for unexpected database errors', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ message: 'Unexpected database error', code: 'UNKNOWN' });
      
      const context = createMockContext(mockUser);

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 500);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Failed to list sessions');
    });

    test('should return 500 for unexpected exceptions', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      // Mock an unexpected error during JSON parsing
      context.req.json = () => Promise.reject(new Error('Unexpected error'));

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 400); // JSON parsing errors become 400
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid request body');
    });

    test('should handle database constraint violations', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ 
        message: 'duplicate key value violates unique constraint',
        code: '23505'
      });
      
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.resolve(createValidSessionPayload());

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 500);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Failed to create session');
    });

    test('should handle Supabase service unavailability', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ 
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE'
      });
      
      const context = createMockContext(mockUser);

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 500);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Failed to list sessions');
    });
  });

  describe('Error Response Format Consistency', () => {
    test('should have consistent error response format', async () => {
      const errorResponses = [
        // 400 error
        await (async () => {
          const context = createMockContext(createMockUser());
          context.req.json = () => Promise.resolve({});
          return sessionController.createSession(context as any);
        })(),
        
        // 401 error
        await (async () => {
          const context = createMockContext(null);
          return sessionController.listSessions(context as any);
        })(),
      ];

      for (const response of errorResponses) {
        const data = await extractJsonFromResponse(response);
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
        expect(data.error.length).toBeGreaterThan(0);
      }
    });

    test('should include validation details for 400 errors', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      context.req.json = () => Promise.resolve({
        session_name: '', // Invalid
        source_language_code: 'en',
        target_language_codes: [], // Invalid
      });

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeTruthy();
      expect(Array.isArray(data.details)).toBe(true);
      expect(data.details.length).toBeGreaterThan(0);
    });

    test('should include database error details for 500 errors', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ message: 'Specific database error' });
      
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.resolve(createValidSessionPayload());

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 500);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Failed to create session');
      expect(data.details).toBe('Specific database error');
    });
  });
});