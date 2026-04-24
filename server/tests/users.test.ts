import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { initTestDb, destroyTestDb, cleanTables } from './setup';
import { User, UserRole } from '../src/entities/User';
import { AppDataSource } from '../src/data-source';
import { generateTokens, hashPassword, verifyPassword } from '../src/services/auth';
import { jwtAuth } from '../src/middleware/jwt-auth';
import { requireRole, requireAdmin } from '../src/middleware/rbac';
import { errorHandler } from '../src/middleware/error-handler';
import usersRoute from '../src/routes/users';
import authRoute from '../src/routes/auth';

beforeAll(initTestDb);
afterAll(destroyTestDb);

let authHeader: Record<string, string>;
let managerHeader: Record<string, string>;
let warehouseHeader: Record<string, string>;
let adminUser: User;
let managerUser: User;
let warehouseUser: User;

const usersApp = new Hono();
usersApp.onError(errorHandler);
usersApp.use('*', jwtAuth);
usersApp.route('/', usersRoute);

function createRbacTestApp(middleware: ReturnType<typeof requireRole>) {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('*', jwtAuth);
  app.use('*', middleware);
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

beforeEach(async () => {
  await cleanTables();
  const userRepo = AppDataSource.getRepository(User);

  adminUser = userRepo.create({
    email: 'admin@test.com',
    passwordHash: await hashPassword('password123'),
    name: 'Admin User',
    role: UserRole.ADMIN,
  });
  adminUser = await userRepo.save(adminUser);

  managerUser = userRepo.create({
    email: 'manager@test.com',
    passwordHash: await hashPassword('password123'),
    name: 'Manager User',
    role: UserRole.MANAGER,
  });
  managerUser = await userRepo.save(managerUser);

  warehouseUser = userRepo.create({
    email: 'warehouse@test.com',
    passwordHash: await hashPassword('password123'),
    name: 'Warehouse User',
    role: UserRole.WAREHOUSE,
  });
  warehouseUser = await userRepo.save(warehouseUser);

  authHeader = { Authorization: `Bearer ${generateTokens(adminUser).accessToken}` };
  managerHeader = { Authorization: `Bearer ${generateTokens(managerUser).accessToken}` };
  warehouseHeader = { Authorization: `Bearer ${generateTokens(warehouseUser).accessToken}` };
});

describe('User Management API', () => {
  test('admin can list users', async () => {
    const res = await usersApp.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    for (const u of body.data) {
      expect(u).not.toHaveProperty('passwordHash');
    }
  });

  test('admin can create user', async () => {
    const res = await usersApp.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'password123',
        name: 'New User',
        role: 'warehouse',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe('new@test.com');
    expect(body.name).toBe('New User');
    expect(body).not.toHaveProperty('passwordHash');
  });

  test('admin cannot create user with duplicate email', async () => {
    const res = await usersApp.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Duplicate',
        role: 'warehouse',
      }),
    });
    expect(res.status).toBe(409);
  });

  test('admin can get single user', async () => {
    const res = await usersApp.request(`/${managerUser.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe('manager@test.com');
    expect(body).not.toHaveProperty('passwordHash');
  });

  test('admin can update user role', async () => {
    const res = await usersApp.request(`/${warehouseUser.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'manager' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe('manager');
  });

  test('admin cannot change own role', async () => {
    const res = await usersApp.request(`/${adminUser.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'warehouse' }),
    });
    expect(res.status).toBe(400);
  });

  test('admin cannot delete self', async () => {
    const res = await usersApp.request(`/${adminUser.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  test('admin can delete other user', async () => {
    const res = await usersApp.request(`/${warehouseUser.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const getRes = await usersApp.request(`/${warehouseUser.id}`, { headers: authHeader });
    expect(getRes.status).toBe(404);
  });
});

describe('RBAC — user endpoints', () => {
  const adminOnlyApp = createRbacTestApp(requireAdmin);

  test('manager gets 403 on users', async () => {
    const res = await adminOnlyApp.request('/test', { headers: managerHeader });
    expect(res.status).toBe(403);
  });

  test('warehouse gets 403 on users', async () => {
    const res = await adminOnlyApp.request('/test', { headers: warehouseHeader });
    expect(res.status).toBe(403);
  });

  test('admin has full access', async () => {
    const res = await adminOnlyApp.request('/test', { headers: authHeader });
    expect(res.status).toBe(200);
  });
});

describe('RBAC — resource restrictions', () => {
  test('warehouse gets 403 on products', async () => {
    const app = createRbacTestApp(requireRole(UserRole.ADMIN, UserRole.MANAGER));
    const res = await app.request('/test', { headers: warehouseHeader });
    expect(res.status).toBe(403);
  });

  test('warehouse gets 403 on orders', async () => {
    const app = createRbacTestApp(requireRole(UserRole.ADMIN, UserRole.MANAGER));
    const res = await app.request('/test', { headers: warehouseHeader });
    expect(res.status).toBe(403);
  });

  test('warehouse gets 403 on reports', async () => {
    const app = createRbacTestApp(requireRole(UserRole.ADMIN, UserRole.MANAGER));
    const res = await app.request('/test', { headers: warehouseHeader });
    expect(res.status).toBe(403);
  });

  test('warehouse gets 403 on audit-logs', async () => {
    const app = createRbacTestApp(requireRole(UserRole.ADMIN, UserRole.MANAGER));
    const res = await app.request('/test', { headers: warehouseHeader });
    expect(res.status).toBe(403);
  });

  test('manager can access products', async () => {
    const app = createRbacTestApp(requireRole(UserRole.ADMIN, UserRole.MANAGER));
    const res = await app.request('/test', { headers: managerHeader });
    expect(res.status).toBe(200);
  });

  test('warehouse can access inventory', async () => {
    const app = createRbacTestApp(requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE));
    const res = await app.request('/test', { headers: warehouseHeader });
    expect(res.status).toBe(200);
  });
});

describe('Change Password', () => {
  test('change-password with correct current password', async () => {
    const res = await authRoute.request('/change-password', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'password123',
        newPassword: 'newpassword456',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const userRepo = AppDataSource.getRepository(User);
    const updated = await userRepo.findOne({ where: { id: adminUser.id } });
    expect(await verifyPassword('newpassword456', updated!.passwordHash)).toBe(true);
  });

  test('change-password with wrong current password returns 401', async () => {
    const res = await authRoute.request('/change-password', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword456',
      }),
    });
    expect(res.status).toBe(401);
  });
});
