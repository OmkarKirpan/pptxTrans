import { Hono, Context, Next } from 'hono';

export const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  // Attempt to get a relative path for logging if BASE_URL is known
  let pathForLog = c.req.path;
  try {
    const baseUrl = c.env?.BASE_URL ? new URL(c.env.BASE_URL as string).pathname : '/';
    if (c.req.path.startsWith(baseUrl) && baseUrl !== '/') {
      pathForLog = c.req.path.substring(baseUrl.length);
      if (!pathForLog.startsWith('/')) pathForLog = '/' + pathForLog;
    }
  } catch (e) {
    // If BASE_URL is invalid or not present, c.req.path is a good fallback
  }
  console.log(`${c.req.method} ${pathForLog} - ${c.res.status} [${ms}ms]`);
}; 