import { Context, Next } from 'hono';
import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // This check runs when the module is loaded. 
  // Consider a more robust startup check or logging for a production service.
  console.error(
    'FATAL: SUPABASE_URL or SUPABASE_ANON_KEY environment variables are not set for authMiddleware.'
  );
  // Optionally, throw an error to prevent the service from starting incorrectly if these are critical.
  // throw new Error('Missing Supabase configuration for authentication.');
}

// Define the environment structure for the factory, if you have other env vars for Hono
// type Env = {
//   Variables: {
//     userId: string;
//     userEmail?: string;
//     supabase: SupabaseClient;
//   };
//   Bindings: {}; // For Cloudflare Workers bindings, if any
// };

const factory = createFactory();

export const authMiddleware = factory.createMiddleware(async (c: Context, next: Next) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // This check is for runtime, in case the service started despite the initial check.
    console.error('authMiddleware: Supabase URL or Anon Key is not configured.');
    throw new HTTPException(500, { message: 'Authentication system not configured.' });
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Create a Supabase client instance specifically for this request, using the provided token.
  // This allows Supabase to validate the token and fetch the user associated with it.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
        // Auto refresh token is not strictly necessary for stateless API requests if tokens are short-lived
        // but good to have if tokens might be re-used by the client making the call.
        autoRefreshToken: true, 
        persistSession: false, // API services typically don't persist sessions
        detectSessionInUrl: false,
    }
  });

  const { data: { user }, error } = await supabase.auth.getUser(); // No need to pass token, it's in client's headers

  if (error) {
    console.error('Supabase auth error:', error.message);
    throw new HTTPException(401, { message: `Unauthorized: ${error.message}` });
  }
  
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized: Invalid token or user not found' });
  }

  // Set user information and the request-specific Supabase client in context
  c.set('userId', user.id);
  if (user.email) {
    c.set('userEmail', user.email);
  }
  // Pass the Supabase client that is authenticated as the user (or using user's token)
  // This is important if subsequent operations need to respect user's RLS policies.
  c.set('supabase', supabase); 

  await next();
});
