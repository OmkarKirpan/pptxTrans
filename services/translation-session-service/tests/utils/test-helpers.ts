import { TranslationSession, CreateSessionPayload, UpdateSessionPayload } from '../../src/model';

export const createValidSessionPayload = (): CreateSessionPayload => ({
  session_name: 'Test Session',
  original_file_name: 'test.pptx',
  source_language_code: 'en',
  target_language_codes: ['es', 'fr'],
  slide_count: 10,
});

export const createMinimalSessionPayload = (): CreateSessionPayload => ({
  session_name: 'Minimal Session',
  source_language_code: 'en',
  target_language_codes: ['es'],
});

export const createValidUpdatePayload = (): UpdateSessionPayload => ({
  session_name: 'Updated Session',
  status: 'in_progress',
  last_opened_at: new Date().toISOString(),
});

export const createMockSession = (overrides: Partial<TranslationSession> = {}): TranslationSession => ({
  id: 'session-123',
  user_id: 'user-456',
  session_name: 'Mock Session',
  original_file_name: 'mock.pptx',
  source_language_code: 'en',
  target_language_codes: ['es', 'fr'],
  status: 'draft',
  slide_count: 5,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  last_opened_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const createMockUser = () => ({
  id: 'user-456',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
});

export const createAuthHeader = (token: string = 'valid-jwt-token') => ({
  Authorization: `Bearer ${token}`,
});

export const createMockContext = (user: any = null) => {
  const contextData = new Map();
  if (user) {
    contextData.set('user', user);
  }

  return {
    req: {
      json: () => Promise.resolve({}),
      param: (key: string) => '',
      query: () => ({}),
      header: (name: string) => '',
    },
    json: (data: any, status?: number) => new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    body: (data: any, status?: number) => new Response(data, { status: status || 200 }),
    get: (key: string) => contextData.get(key),
    set: (key: string, value: any) => contextData.set(key, value),
  };
};

export const extractJsonFromResponse = async (response: Response) => {
  const text = await response.text();
  return JSON.parse(text);
};

export const assertResponseStatus = (response: Response, expectedStatus: number) => {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }
};

export const assertValidationError = async (response: Response, expectedField?: string) => {
  assertResponseStatus(response, 400);
  const data = await extractJsonFromResponse(response);
  
  if (!data.error) {
    throw new Error('Expected error field in response');
  }
  
  if (expectedField && data.details) {
    const hasFieldError = data.details.some((detail: any) => 
      detail.path && detail.path.includes(expectedField)
    );
    if (!hasFieldError) {
      throw new Error(`Expected validation error for field: ${expectedField}`);
    }
  }
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));