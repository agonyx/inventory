import type { Context } from 'hono';
import { AppError, ErrorCode } from '../errors/app-error';

export function errorHandler(err: Error, c: Context) {
  console.error('Request error:', err);

  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Fallback for unexpected errors
  const status = err.message?.includes('already exists') ? 409
    : err.message?.includes('not found') ? 404
    : err.message?.includes('Cannot reduce') ? 400
    : 500;

  const code = status === 409 ? ErrorCode.CONFLICT
    : status === 404 ? ErrorCode.NOT_FOUND
    : status === 400 ? ErrorCode.VALIDATION_ERROR
    : ErrorCode.INTERNAL_ERROR;

  return c.json(
    { error: { code, message: err.message || 'Internal Server Error', details: null } },
    status as 400 | 404 | 409 | 500
  );
}
