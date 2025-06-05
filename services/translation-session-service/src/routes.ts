import { Hono } from 'hono';
import { sessionController } from '@/controller'; // Assumes controller.ts is at src/controller.ts
import { authMiddleware } from '@/middleware/auth'; // Assumes auth.ts is at src/middleware/auth.ts

const sessionRoutes = new Hono();

// Apply auth middleware to all session routes
sessionRoutes.use('*', authMiddleware);

sessionRoutes.post('/', sessionController.createSession);
sessionRoutes.get('/', sessionController.listSessions);
sessionRoutes.get('/:sessionId', sessionController.getSessionById);
sessionRoutes.put('/:sessionId', sessionController.updateSession);
sessionRoutes.delete('/:sessionId', sessionController.deleteSession);

export default sessionRoutes; 