import { Context, Next } from 'hono';
import { supabase } from '@/db'; // Assumes db.ts is correctly set up at src/db.ts

interface User {
  id: string;
  aud: string;
  role: string;
  email?: string;
  // Add other user properties from Supabase JWT as needed
}

// Extend Hono's Context to include the user property
// This is one way to do it; an alternative is to use c.set/c.get
// declare module 'hono' {
//   interface ContextVariableMap {
//     user?: User;
//   }
// }

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or malformed token' }, 401);
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing token' }, 401);
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error?.message);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // You can set the user object in the context for downstream handlers
    c.set('user', user as User); 
    // Or if using module augmentation for ContextVariableMap:
    // c.user = user as User;

    await next();
  } catch (e: any) {
    console.error('Unexpected error during authentication:', e.message);
    return c.json({ error: 'Internal server error during authentication' }, 500);
  }
}; 