import type { MiddlewareHandler } from 'hono';
import { logger } from '../utils/logger';

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const userId = c.get('auth')?.userId ?? null;
  const method = c.req.method;
  const path = c.req.path;
  const status = c.res.status;
  logger.info({ method, path, status, duration, userId }, `${method} ${path}`);
};
