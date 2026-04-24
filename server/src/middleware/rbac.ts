import type { MiddlewareHandler } from 'hono';
import { UserRole } from '../entities/User';
import { AppError, ErrorCode } from '../errors/app-error';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.MANAGER]: [
    'products', 'orders', 'inventory', 'reports', 'transfers',
    'stocktakes', 'pick-list', 'audit-logs', 'locations',
    'notifications', 'webhooks/config', 'suppliers', 'purchase-orders', 'returns',
  ],
  [UserRole.WAREHOUSE]: [
    'pick-list', 'inventory', 'transfers', 'stocktakes',
    'locations', 'notifications', 'orders',
  ],
};

export function requireRole(...roles: UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing authorization');
    }
    if (!roles.includes(auth.role as UserRole)) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }
    await next();
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);
