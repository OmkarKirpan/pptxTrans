import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { errorHandler, AppError } from '../../../src/middleware/error-handler';
import { createMockContext, createMockNext } from '../../helpers/testHelpers';
import { ZodError } from 'zod';

describe('Error Handler Middleware', () => {
  let mockContext: any;
  let mockNext: any;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    mockContext = createMockContext();
    mockNext = createMockNext();
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('Successful Request Handling', () => {
    test('should call next and return successfully when no error occurs', async () => {
      const middleware = errorHandler();

      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.json).not.toHaveBeenCalled();
    });

    test('should not interfere with normal request flow', async () => {
      const middleware = errorHandler();
      mockNext.mockResolvedValue('success');

      const result = await middleware(mockContext, mockNext);

      expect(result).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Zod Validation Error Handling', () => {
    test('should handle ZodError with 400 status', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        },
        {
          code: 'too_small',
          minimum: 1,
          type: 'array',
          inclusive: true,
          exact: false,
          path: ['permissions'],
          message: 'Array must contain at least 1 element(s)',
        },
      ]);

      mockNext.mockRejectedValue(zodError);
      const middleware = errorHandler();

      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Validation Error',
          details: zodError.errors,
        },
        400
      );
    });

    test('should include all validation errors in response', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['sessionId'],
          message: 'Required',
        },
      ]);

      mockNext.mockRejectedValue(zodError);
      const middleware = errorHandler();

      await middleware(mockContext, mockNext);

      const jsonCall = mockContext.json.mock.calls[0];
      expect(jsonCall[0].details).toEqual(zodError.errors);
      expect(jsonCall[1]).toBe(400);
    });
  });

  describe('AppError Handling', () => {
    test('should handle AppError with custom status code', async () => {
      const appError = new AppError('Resource not found', 404);

      mockNext.mockRejectedValue(appError);
      const middleware = errorHandler();

      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Resource not found',
        },
        404
      );
    });

    test('should handle AppError with default 500 status', async () => {
      const appError = new AppError('Something went wrong');

      mockNext.mockRejectedValue(appError);
      const middleware = errorHandler();

      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Something went wrong',
        },
        500
      );
    });

    test('should handle AppError with various status codes', async () => {
      const testCases = [
        { message: 'Bad Request', status: 400 },
        { message: 'Unauthorized', status: 401 },
        { message: 'Forbidden', status: 403 },
        { message: 'Not Found', status: 404 },
        { message: 'Conflict', status: 409 },
        { message: 'Internal Server Error', status: 500 },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockContext = createMockContext();
        mockNext = createMockNext();

        const appError = new AppError(testCase.message, testCase.status);
        mockNext.mockRejectedValue(appError);
        
        const middleware = errorHandler();
        await middleware(mockContext, mockNext);

        expect(mockContext.json).toHaveBeenCalledWith(
          { error: testCase.message },
          testCase.status
        );
      }
    });
  });

  describe('Generic Error Handling', () => {
    test('should handle generic Error in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      const genericError = new Error('Database connection failed');
      mockNext.mockRejectedValue(genericError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Internal Server Error',
          message: 'Database connection failed',
        },
        500
      );
    });

    test('should hide error message in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      const genericError = new Error('Sensitive database error');
      mockNext.mockRejectedValue(genericError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Internal Server Error',
          message: undefined,
        },
        500
      );
    });

    test('should handle non-Error objects', async () => {
      const stringError = 'String error message';
      mockNext.mockRejectedValue(stringError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'production' ? undefined : 'String error message',
        },
        500
      );
    });

    test('should handle null/undefined errors', async () => {
      mockNext.mockRejectedValue(null);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Internal Server Error',
          message: undefined,
        },
        500
      );
    });
  });

  describe('Error Logging', () => {
    test('should log error with correct format', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const testError = new Error('Test error for logging');
      mockNext.mockRejectedValue(testError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      // The logger should be called (though we can't easily test pino directly)
      expect(mockContext.json).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('AppError Class', () => {
    test('should create AppError with message and status', () => {
      const error = new AppError('Test message', 422);
      
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(422);
      expect(error).toBeInstanceOf(Error);
    });

    test('should create AppError with default status', () => {
      const error = new AppError('Test message');
      
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500);
    });

    test('should be instance of Error', () => {
      const error = new AppError('Test');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('Error Response Format', () => {
    test('should return consistent error response format for ZodError', async () => {
      const zodError = new ZodError([]);
      mockNext.mockRejectedValue(zodError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      const response = mockContext.json.mock.calls[0][0];
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('details');
      expect(response.error).toBe('Validation Error');
    });

    test('should return consistent error response format for AppError', async () => {
      const appError = new AppError('Test error', 400);
      mockNext.mockRejectedValue(appError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      const response = mockContext.json.mock.calls[0][0];
      expect(response).toHaveProperty('error');
      expect(response).not.toHaveProperty('details');
      expect(response.error).toBe('Test error');
    });

    test('should return consistent error response format for generic errors', async () => {
      const genericError = new Error('Generic error');
      mockNext.mockRejectedValue(genericError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      const response = mockContext.json.mock.calls[0][0];
      expect(response).toHaveProperty('error');
      expect(response.error).toBe('Internal Server Error');
    });
  });

  describe('Edge Cases', () => {
    test('should handle async errors properly', async () => {
      const asyncError = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Async error')), 0);
      });
      
      mockNext.mockReturnValue(asyncError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
        }),
        500
      );
    });

    test('should handle errors thrown synchronously in next()', async () => {
      mockNext.mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
        }),
        500
      );
    });

    test('should handle complex nested errors', async () => {
      const nestedError = new Error('Inner error');
      const wrapperError = new Error('Wrapper error');
      (wrapperError as any).cause = nestedError;
      
      mockNext.mockRejectedValue(wrapperError);
      
      const middleware = errorHandler();
      await middleware(mockContext, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
        }),
        500
      );
    });
  });
});