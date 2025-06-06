import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

import { shareController } from './controllers/shareController';
import { errorHandler } from './middleware/error-handler';
import { createLogger } from './utils/logger';

const log = createLogger('app');
const port = parseInt(process.env.PORT || '3001');

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: ['http://localhost:3000', process.env.FRONTEND_URL || '*'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));
app.use('*', errorHandler());

// Routes
app.get('/', (c) => c.json({ message: 'Share Service API', status: 'OK' }));
app.get('/health', (c) => c.json({ status: 'OK' }));

// Share endpoints
app.route('/api/share', shareController);

// Start server
log.info(`Starting server on port ${port}`);
export default {
  port,
  fetch: app.fetch,
}; 