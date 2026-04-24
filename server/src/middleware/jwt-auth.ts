import type { MiddlewareHandler } from 'hono';
import { verifyAccessToken } from '../services/auth';
import { AppError, ErrorCode } from '../errors/app-error';

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const jwtAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization');
  const token = auth?.replace('Bearer ', '');
  if (!token) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing authorization header');
  }

  const payload = verifyAccessToken(token);
  c.set('auth', { userId: payload.userId, email: payload.email, role: payload.role });
  await next();
};
