import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loggerMiddleware } from './middleware/logger';
import sessionRoutes from '@/routes';

const app = new Hono();

// CORS configuration - adjust origin as needed for your frontend URL
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Allow frontend dev server
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // If you need to handle cookies/sessions from frontend
}));

// Logger middleware
app.use('*', loggerMiddleware);

// API versioning (optional, but good practice)
const api = new Hono().basePath('/api/v1');

// Mount session routes
api.route('/sessions', sessionRoutes);

// Register the base API path with the main app
app.route('/', api);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', message: 'Translation Session Service is healthy' });
});

const port = parseInt(process.env.PORT || '3001', 10);
console.log(`Translation Session Service running on port ${port}`);

export default {
  port: port,
  fetch: app.fetch,
}; 