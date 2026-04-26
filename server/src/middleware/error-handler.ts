import type { Context } from 'hono';
import { AppError, ErrorCode } from '../errors/app-error';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, c: Context) {
  logger.error({ err, path: c.req.path }, 'Request error');

  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Fallback for unexpected errors — never expose internal details
  const status = err.message?.includes('already exists') ? 409
    : err.message?.includes('not found') ? 404
    : err.message?.includes('Cannot reduce') ? 400
    : 500;

  const code = status === 409 ? ErrorCode.CONFLICT
    : status === 404 ? ErrorCode.NOT_FOUND
    : status === 400 ? ErrorCode.VALIDATION_ERROR
    : ErrorCode.INTERNAL_ERROR;

  const message = status !== 500
    ? (err.message || 'Request failed')
    : 'Internal Server Error';

  return c.json(
    { error: { code, message, details: null } },
    status as 400 | 404 | 409 | 500
  );
}
