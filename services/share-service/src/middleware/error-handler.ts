import { Context, MiddlewareHandler } from 'hono';
import { ZodError } from 'zod';
import { createLogger } from '../utils/logger';

const log = createLogger('error-handler');

class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err: any) {
      log.error({ err }, 'Error caught in middleware');
      
      if (err instanceof ZodError) {
        return c.json({
          error: 'Validation Error',
          details: err.errors,
        }, 400);
      }
      
      if (err instanceof AppError) {
        return c.json({
          error: err.message,
        }, err.statusCode);
      }
      
      // Default error response
      return c.json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? undefined : err.message,
      }, 500);
    }
  };
}

export { AppError }; 