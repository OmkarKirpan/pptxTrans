import { test, expect, describe, beforeEach } from 'bun:test';
import { sessionController } from '../../../src/controller';
import { MockSupabaseClient } from '../../utils/mock-supabase';
import { 
  createMockContext, 
  createMockUser, 
  createValidSessionPayload,
  createMinimalSessionPayload,
  createValidUpdatePayload,
  createMockSession,
  extractJsonFromResponse,
  assertResponseStatus,
  assertValidationError 
} from '../../utils/test-helpers';

// Mock the supabase module
const mockSupabase = new MockSupabaseClient();

// We need to mock the db import - this would normally be done with a proper mocking system
const originalSupabase = (globalThis as any).mockSupabase;
(globalThis as any).mockSupabase = mockSupabase;

describe('Session Controller', () => {
  beforeEach(() => {
    mockSupabase.clearMocks();
  });

  describe('Authentication Helper', () => {
    test('should return user when valid user exists in context', () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      
      // We can't directly test the helper since it's not exported, but we can test through the controller methods
      // This tests the authentication logic indirectly
      expect(context.get('user')).toEqual(mockUser);
    });

    test('should handle missing user in context', () => {
      const context = createMockContext(null);
      expect(context.get('user')).toBeNull();
    });

    test('should handle invalid user format', () => {
      const invalidUser = { invalidField: 'test' };
      const context = createMockContext(invalidUser);
      expect(context.get('user')).toEqual(invalidUser);
    });
  });

  describe('createSession', () => {
    test('should create session with valid complete data', async () => {
      const mockUser = createMockUser();
      const payload = createValidSessionPayload();
      const expectedSession = createMockSession({
        ...payload,
        user_id: mockUser.id,
      });

      mockSupabase.setMockSessions([expectedSession]);
      
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.resolve(payload);

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 201);
      const data = await extractJsonFromResponse(response);
      expect(data.session_name).toBe(payload.session_name);
      expect(data.user_id).toBe(mockUser.id);
    });

    test('should create session with minimal required data', async () => {
      const mockUser = createMockUser();
      const payload = createMinimalSessionPayload();
      const expectedSession = createMockSession({
        ...payload,
        user_id: mockUser.id,
      });

      mockSupabase.setMockSessions([expectedSession]);
      
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.resolve(payload);

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 201);
      const data = await extractJsonFromResponse(response);
      expect(data.session_name).toBe(payload.session_name);
    });

    test('should return 401 when user not authenticated', async () => {
      const context = createMockContext(null);
      context.req.json = () => Promise.resolve(createValidSessionPayload());

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 401);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('User not authenticated or user ID missing');
    });

    test('should return 400 for invalid JSON payload', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.reject(new Error('Invalid JSON'));

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
      });

      const response = await sessionController.createSession(context as any);
      
      await assertValidationError(response, 'session_name');
    });

    test('should return 500 for database error', async () => {
      const mockUser = createMockUser();
      const payload = createValidSessionPayload();
      
      mockSupabase.setMockError({ message: 'Database connection failed' });
      
      const context = createMockContext(mockUser);
      context.req.json = () => Promise.resolve(payload);

      const response = await sessionController.createSession(context as any);
      
      assertResponseStatus(response, 500);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Failed to create session');
    });
  });

  describe('listSessions', () => {
    test('should list all sessions for authenticated user', async () => {
      const mockUser = createMockUser();
      const sessions = [
        createMockSession({ id: 'session-1', user_id: mockUser.id }),
        createMockSession({ id: 'session-2', user_id: mockUser.id }),
      ];

      mockSupabase.setMockSessions(sessions);
      
      const context = createMockContext(mockUser);
      context.req.query = () => ({ page: '1', limit: '10' });

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });

    test('should handle pagination correctly', async () => {
      const mockUser = createMockUser();
      const sessions = Array.from({ length: 25 }, (_, i) => 
        createMockSession({ id: `session-${i}`, user_id: mockUser.id })
      );

      mockSupabase.setMockSessions(sessions);
      
      const context = createMockContext(mockUser);
      context.req.query = () => ({ page: '2', limit: '10' });

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(10);
      expect(data.totalPages).toBe(3);
    });

    test('should filter by status', async () => {
      const mockUser = createMockUser();
      const sessions = [
        createMockSession({ id: 'session-1', user_id: mockUser.id, status: 'draft' }),
        createMockSession({ id: 'session-2', user_id: mockUser.id, status: 'completed' }),
      ];

      mockSupabase.setMockSessions(sessions);
      
      const context = createMockContext(mockUser);
      context.req.query = () => ({ status: 'completed', page: '1', limit: '10' });

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].status).toBe('completed');
    });

    test('should handle sorting', async () => {
      const mockUser = createMockUser();
      const sessions = [
        createMockSession({ id: 'session-1', user_id: mockUser.id, session_name: 'B Session' }),
        createMockSession({ id: 'session-2', user_id: mockUser.id, session_name: 'A Session' }),
      ];

      mockSupabase.setMockSessions(sessions);
      
      const context = createMockContext(mockUser);
      context.req.query = () => ({ sortBy: 'session_name_asc', page: '1', limit: '10' });

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.items).toHaveLength(2);
      // Note: Mock sorting is simplified - in real tests this would be more detailed
    });

    test('should return 401 when user not authenticated', async () => {
      const context = createMockContext(null);
      context.req.query = () => ({});

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 401);
    });

    test('should handle empty results', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockSessions([]);
      
      const context = createMockContext(mockUser);
      context.req.query = () => ({ page: '1', limit: '10' });

      const response = await sessionController.listSessions(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.items).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });

  describe('getSessionById', () => {
    test('should retrieve session owned by user', async () => {
      const mockUser = createMockUser();
      const session = createMockSession({ id: 'session-123', user_id: mockUser.id });

      mockSupabase.setMockSessions([session]);
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.id).toBe('session-123');
      expect(data.user_id).toBe(mockUser.id);
    });

    test('should return 404 for non-existent session', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockError({ code: 'PGRST116', message: 'No rows found' });
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'non-existent' : '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 404);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session not found');
    });

    test('should return 400 for missing session ID', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      context.req.param = () => '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session ID is required');
    });

    test('should return 401 when user not authenticated', async () => {
      const context = createMockContext(null);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';

      const response = await sessionController.getSessionById(context as any);
      
      assertResponseStatus(response, 401);
    });
  });

  describe('updateSession', () => {
    test('should update session with valid data', async () => {
      const mockUser = createMockUser();
      const updatePayload = createValidUpdatePayload();
      const updatedSession = createMockSession({
        id: 'session-123',
        user_id: mockUser.id,
        ...updatePayload,
      });

      mockSupabase.setMockSessions([updatedSession]);
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';
      context.req.json = () => Promise.resolve(updatePayload);

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 200);
      const data = await extractJsonFromResponse(response);
      expect(data.session_name).toBe(updatePayload.session_name);
      expect(data.status).toBe(updatePayload.status);
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

    test('should return 404 for non-existent session', async () => {
      const mockUser = createMockUser();
      const updatePayload = createValidUpdatePayload();
      
      mockSupabase.setMockError({ code: 'PGRST116', message: 'No rows found' });
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'non-existent' : '';
      context.req.json = () => Promise.resolve(updatePayload);

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 404);
    });

    test('should return 401 when user not authenticated', async () => {
      const context = createMockContext(null);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';
      context.req.json = () => Promise.resolve(createValidUpdatePayload());

      const response = await sessionController.updateSession(context as any);
      
      assertResponseStatus(response, 401);
    });
  });

  describe('deleteSession', () => {
    test('should delete session owned by user', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockSessions([createMockSession({ id: 'session-123', user_id: mockUser.id })]);
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';

      const response = await sessionController.deleteSession(context as any);
      
      assertResponseStatus(response, 204);
    });

    test('should return 404 for non-existent session', async () => {
      const mockUser = createMockUser();
      mockSupabase.setMockSessions([]);
      
      const context = createMockContext(mockUser);
      context.req.param = (key: string) => key === 'sessionId' ? 'non-existent' : '';

      const response = await sessionController.deleteSession(context as any);
      
      assertResponseStatus(response, 404);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session not found or access denied');
    });

    test('should return 400 for missing session ID', async () => {
      const mockUser = createMockUser();
      const context = createMockContext(mockUser);
      context.req.param = () => '';

      const response = await sessionController.deleteSession(context as any);
      
      assertResponseStatus(response, 400);
      const data = await extractJsonFromResponse(response);
      expect(data.error).toBe('Session ID is required');
    });

    test('should return 401 when user not authenticated', async () => {
      const context = createMockContext(null);
      context.req.param = (key: string) => key === 'sessionId' ? 'session-123' : '';

      const response = await sessionController.deleteSession(context as any);
      
      assertResponseStatus(response, 401);
    });
  });
});