import type { MiddlewareHandler } from 'hono';
import { UserRole } from '../entities/User';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
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

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: auth.userId }, select: ['id', 'role'] });
    if (!user) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
    }

    const freshRole = user.role;
    if (!roles.includes(freshRole)) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    c.set('auth', { ...auth, role: freshRole });
    await next();
  };
}

export function requirePermission(resource: string): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing authorization');
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: auth.userId }, select: ['id', 'role'] });
    if (!user) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
    }

    const freshRole = user.role;
    const permissions = ROLE_PERMISSIONS[freshRole];
    if (!permissions?.includes('*') && !permissions?.includes(resource)) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    c.set('auth', { ...auth, role: freshRole });
    await next();
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);
