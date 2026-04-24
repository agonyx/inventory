# Phase 1 - Foundation and Security Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make it safe to deploy with real data — no new features, just harden what exists.

**Architecture:** Centralized error handling with AppError class, JWT-based auth replacing static bearer tokens, HMAC-SHA256 webhook verification, database transactions with optimistic locking, TypeORM migrations for safe schema evolution, Docker hardening with security headers and resource limits, and a new audit log viewer API + frontend page.

**Tech Stack:** Hono + TypeORM + PostgreSQL (server), React + Vite + TailwindCSS + React Query (web), Docker + nginx, Bun locally / Node.js in Docker. New deps: `jsonwebtoken`, `bcryptjs` (server); no new frontend deps needed.

---

## 1.1 Error Handling Standardization

### Task 1.1.1: Create AppError class and error codes enum

**Objective:** Create a reusable AppError class with structured error codes that all routes can throw instead of raw strings.

**Files:**
- Create: `server/src/errors/app-error.ts`

**Step 1: Write the AppError class**

```typescript
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface AppErrorDetails {
  field?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: AppErrorDetails;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: AppErrorDetails
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/errors/app-error.ts
git commit -m "feat(errors): add AppError class with structured error codes"
```

---

### Task 1.1.2: Create global error handler middleware

**Objective:** Replace the fragile string-matching error handler in `index.ts` with a clean AppError-aware handler.

**Files:**
- Create: `server/src/middleware/error-handler.ts`
- Modify: `server/src/index.ts` (replace app.onError block)

**Step 1: Write error handler middleware**

```typescript
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
```

**Step 2: Replace in index.ts**

Replace lines 37-42 in `server/src/index.ts`:

```typescript
// OLD:
app.onError((err, c) => {
  console.error('Request error:', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  const status = message.includes('already exists') ? 409 : message.includes('not found') ? 404 : message.includes('Cannot reduce') ? 400 : 500;
  return c.json({ error: message }, status as 400 | 404 | 409 | 500);
});

// NEW:
import { errorHandler } from './middleware/error-handler';
app.onError(errorHandler);
```

**Step 3: Run tests to verify no regressions**

```bash
cd ~/projects/niche-inventory/server
bun test tests/products.test.ts
bun test tests/orders.test.ts
bun test tests/webhooks.test.ts
bun test tests/inventory.test.ts
```

Expected: all tests pass (same behavior, just structured error format).

**Step 4: Commit**

```bash
git add server/src/middleware/error-handler.ts server/src/index.ts
git commit -m "feat(errors): add global error handler with AppError support"
```

---

### Task 1.1.3: Replace error strings in webhooks.ts with AppError

**Objective:** Remove fragile string-matching from webhooks.ts by throwing AppError in the service layer.

**Files:**
- Modify: `server/src/services/orderProcessor.ts`
- Modify: `server/src/routes/webhooks.ts`

**Step 1: Update orderProcessor.ts to throw AppError**

Replace the `throw new Error(...)` calls in `server/src/services/orderProcessor.ts`:

```typescript
import { AppError, ErrorCode } from '../errors/app-error';

// In processWebhookOrder, replace:
// throw new Error(`Order ${payload.externalOrderId} already exists`);
// →
throw new AppError(409, ErrorCode.CONFLICT, `Order ${payload.externalOrderId} already exists`);

// throw new Error(`Variant with SKU ${item.sku} not found`);
// →
throw new AppError(404, ErrorCode.NOT_FOUND, `Variant with SKU ${item.sku} not found`);

// throw new Error(`No inventory found for SKU ${item.sku}`);
// →
throw new AppError(404, ErrorCode.NOT_FOUND, `No inventory found for SKU ${item.sku}`);

// throw new Error(`Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${totalAvailable}`);
// →
throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK, `Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${totalAvailable}`);

// throw new Error(`Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${available}`);
// →
throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK, `Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${available}`);
```

**Step 2: Simplify webhooks.ts error handler**

Replace the try/catch in `server/src/routes/webhooks.ts`:

```typescript
// OLD:
app.post('/orders', zValidator('json', webhookSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const order = await processWebhookOrder(data);
    return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('already exists') ? 409
      : message.includes('not found') || message.includes('No inventory') ? 404
      : message.includes('Insufficient') ? 400
      : 500;
    return c.json({ success: false, error: message }, status as 400 | 404 | 409 | 500);
  }
});

// NEW:
app.post('/orders', zValidator('json', webhookSchema), async (c) => {
  const data = c.req.valid('json');
  const order = await processWebhookOrder(data);
  return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
});
```

The global error handler now catches AppError and formats the response.

**Step 3: Update webhook tests to check new error format**

In `server/tests/webhooks.test.ts`, update the error assertions:

```typescript
// Line ~82: expect((await second.json()).error).toContain('already exists');
// → check the nested format:
const body = await second.json();
expect(body.error.message).toContain('already exists');
expect(body.error.code).toBe('CONFLICT');

// Line ~99: expect((await res.json()).error).toContain('not found');
const body = await res.json();
expect(body.error.message).toContain('not found');
expect(body.error.code).toBe('NOT_FOUND');

// Line ~125: expect((await res.json()).error).toContain('Insufficient');
const body = await res.json();
expect(body.error.message).toContain('Insufficient');
expect(body.error.code).toBe('INSUFFICIENT_STOCK');
```

**Step 4: Run webhook tests**

```bash
cd ~/projects/niche-inventory/server
bun test tests/webhooks.test.ts
```

Expected: 5 passed.

**Step 5: Commit**

```bash
git add server/src/services/orderProcessor.ts server/src/routes/webhooks.ts server/tests/webhooks.test.ts
git commit -m "refactor(errors): use AppError in orderProcessor and simplify webhooks route"
```

---

### Task 1.1.4: Replace error strings in all API routes with AppError

**Objective:** Convert all `c.json({ error: '...' }, status)` responses in routes to `throw new AppError(...)`.

**Files:**
- Modify: `server/src/routes/products.ts`
- Modify: `server/src/routes/inventory.ts`
- Modify: `server/src/routes/locations.ts`
- Modify: `server/src/routes/orders.ts`
- Modify: `server/src/routes/alerts.ts` (if any errors)
- Modify: `server/src/routes/pickList.ts` (if any errors)

**Step 1: Update products.ts**

Add import: `import { AppError, ErrorCode } from '../errors/app-error';`

Replace each `return c.json({ error: 'Not found' }, 404)`:
```typescript
// Line ~48:
if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');

// Line ~104:
if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');

// Line ~121-122:
if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
// Line ~127:
if (result.affected === 0) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
```

**Step 2: Update inventory.ts**

```typescript
// Line ~40:
if (!level) throw new AppError(404, ErrorCode.NOT_FOUND, 'Inventory level not found');

// Line ~46:
if (newQty < 0) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot reduce stock below zero');

// Line ~50:
if (newQty < level.reservedQuantity) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot reduce stock below reserved quantity');
```

**Step 3: Update locations.ts**

```typescript
// Line ~33:
if (!location) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');

// Line ~42:
if (result.affected === 0) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');
```

**Step 4: Update orders.ts**

```typescript
// Line ~36:
if (!order) throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');

// Line ~47:
if (!order) throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
```

**Step 5: Update tests to match new error format**

For each test file, update error assertions from:
```typescript
expect((await res.json()).error).toMatch(/not found/i);
```
to:
```typescript
const body = await res.json();
expect(body.error.message).toMatch(/not found/i);
```

Files to update:
- `server/tests/products.test.ts` (lines ~68, ~88)
- `server/tests/inventory.test.ts` (lines ~126, ~161, ~179)
- `server/tests/locations.test.ts` (lines ~86, ~96, ~107)
- `server/tests/orders.test.ts` (lines ~58, ~155)

**Step 6: Run all tests**

```bash
cd ~/projects/niche-inventory/server
bun run test
```

Expected: all 44 tests pass.

**Step 7: Commit**

```bash
git add server/src/routes/*.ts server/tests/*.test.ts
git commit -m "refactor(errors): replace all c.json error responses with AppError throws"
```

---

## 1.2 Authentication System

### Task 1.2.1: Install auth dependencies

**Objective:** Add jsonwebtoken and bcryptjs to server dependencies.

**Files:**
- Modify: `server/package.json`

**Step 1: Install packages**

```bash
cd ~/projects/niche-inventory/server
bun add jsonwebtoken bcryptjs
bun add -d @types/jsonwebtoken @types/bcryptjs
```

**Step 2: Commit**

```bash
git add server/package.json
git commit -m "deps: add jsonwebtoken and bcryptjs for auth"
```

---

### Task 1.2.2: Create User entity

**Objective:** Add User entity with role enum for RBAC foundation.

**Files:**
- Create: `server/src/entities/User.ts`

**Step 1: Write User entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  WAREHOUSE = 'warehouse',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.WAREHOUSE })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date | null;
}
```

**Step 2: Register User in data-source.ts**

Add `User` to the entities array in `server/src/data-source.ts`:

```typescript
import { User } from './entities/User';
// ...
entities: [Product, ProductVariant, Location, InventoryLevel, Order, OrderItem, StockAdjustment, AuditLog, User],
```

**Step 3: Commit**

```bash
git add server/src/entities/User.ts server/src/data-source.ts
git commit -m "feat(auth): add User entity with role enum"
```

---

### Task 1.2.3: Create auth service (password hashing + JWT)

**Objective:** Centralize password hashing and JWT generation/verification.

**Files:**
- Create: `server/src/services/auth.ts`

**Step 1: Write auth service**

```typescript
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { AppError, ErrorCode } from '../errors/app-error';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_ACCESS_EXPIRY = '15m';
const JWT_REFRESH_EXPIRY = '7d';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export function generateTokens(user: User): TokenPair {
  const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (decoded.type !== 'refresh') {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid token type');
    }
    return { userId: decoded.userId };
  } catch {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid or expired refresh token');
  }
}

export async function authenticateUser(email: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { email } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid email or password');
  }

  user.lastLogin = new Date();
  await userRepo.save(user);

  return { user, tokens: generateTokens(user) };
}
```

**Step 2: Commit**

```bash
git add server/src/services/auth.ts
git commit -m "feat(auth): add auth service with password hashing and JWT"
```

---

### Task 1.2.4: Create auth routes

**Objective:** Add login, refresh, logout, and me endpoints.

**Files:**
- Create: `server/src/routes/auth.ts`

**Step 1: Write auth routes**

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import {
  authenticateUser,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
} from '../services/auth';
import { AppError, ErrorCode } from '../errors/app-error';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const app = new Hono();

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const { user, tokens } = await authenticateUser(email, password);
  return c.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens,
  });
});

app.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const { userId } = verifyRefreshToken(refreshToken);
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }
  const tokens = generateTokens(user);
  return c.json({ tokens });
});

app.post('/logout', async (c) => {
  // Stateless JWT — client discards tokens. In future, add token blacklist.
  return c.json({ success: true });
});

app.get('/me', async (c) => {
  const auth = c.req.header('Authorization');
  const token = auth?.replace('Bearer ', '');
  if (!token) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing authorization header');
  }
  const payload = verifyAccessToken(token);
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

export default app;
```

**Step 2: Register auth routes in index.ts**

Add to `server/src/index.ts` after the public routes block:

```typescript
import authRoute from './routes/auth';
// ...
app.route('/api/auth', authRoute);
```

**Step 3: Commit**

```bash
git add server/src/routes/auth.ts server/src/index.ts
git commit -m "feat(auth): add login, refresh, logout, and me endpoints"
```

---

### Task 1.2.5: Create JWT auth middleware

**Objective:** Replace the static token middleware with JWT verification.

**Files:**
- Create: `server/src/middleware/jwt-auth.ts`
- Modify: `server/src/index.ts` (replace auth middleware)

**Step 1: Write JWT auth middleware**

```typescript
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
```

**Step 2: Replace auth middleware in index.ts**

Replace lines 22-28 in `server/src/index.ts`:

```typescript
// OLD:
app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token !== process.env.AUTH_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// NEW:
import { jwtAuth } from './middleware/jwt-auth';
app.use('/api/*', jwtAuth);
```

**Step 3: Commit**

```bash
git add server/src/middleware/jwt-auth.ts server/src/index.ts
git commit -m "feat(auth): replace static token with JWT auth middleware"
```

---

### Task 1.2.6: Create seed script for default admin

**Objective:** Create a script that seeds a default admin user if no users exist.

**Files:**
- Create: `server/src/scripts/seed-admin.ts`

**Step 1: Write seed script**

```typescript
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';
import { hashPassword } from '../services/auth';

async function seedAdmin() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  const count = await userRepo.count();
  if (count > 0) {
    console.log('Users already exist, skipping admin seed');
    await AppDataSource.destroy();
    return;
  }

  const admin = userRepo.create({
    email: process.env.ADMIN_EMAIL || 'admin@nicheinventory.local',
    passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
    name: 'Admin',
    role: UserRole.ADMIN,
  });

  await userRepo.save(admin);
  console.log(`Admin user created: ${admin.email}`);
  await AppDataSource.destroy();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

**Step 2: Add script to package.json**

Add to `server/package.json` scripts:
```json
"db:seed:admin": "bun run src/scripts/seed-admin.ts"
```

**Step 3: Commit**

```bash
git add server/src/scripts/seed-admin.ts server/package.json
git commit -m "feat(auth): add admin seed script"
```

---

### Task 1.2.7: Update test helpers for JWT auth

**Objective:** Update test setup to support JWT tokens instead of static AUTH_TOKEN.

**Files:**
- Modify: `server/tests/setup.ts`
- Modify: `server/tests/helpers.ts`

**Step 1: Update setup.ts**

Replace the `AUTH_TOKEN` and `authHeader` exports:

```typescript
// OLD:
export const AUTH_TOKEN = process.env.AUTH_TOKEN || 'niche-inventory-secret-2026';
export const authHeader = { Authorization: `Bearer ${AUTH_TOKEN}` };

// NEW:
import { generateTokens } from '../src/services/auth';
import { User, UserRole } from '../src/entities/User';

// Create a test user and generate a token for it
let testUser: User | null = null;

export async function getTestAuthHeader() {
  if (!testUser) {
    const userRepo = AppDataSource.getRepository(User);
    testUser = userRepo.create({
      email: 'test@example.com',
      passwordHash: 'not-used-in-tests',
      name: 'Test User',
      role: UserRole.ADMIN,
    });
    testUser = await userRepo.save(testUser);
  }
  const { accessToken } = generateTokens(testUser);
  return { Authorization: `Bearer ${accessToken}` };
}
```

**Step 2: Update all test files to use async auth header**

In each test file, replace the static `authHeader` import with a beforeEach setup:

```typescript
// OLD in each test file:
import { authHeader } from './setup';

// NEW:
import { getTestAuthHeader } from './setup';
let authHeader: Record<string, string>;

beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});
```

Files to update:
- `server/tests/products.test.ts`
- `server/tests/inventory.test.ts`
- `server/tests/locations.test.ts`
- `server/tests/orders.test.ts`
- `server/tests/pickList.test.ts`
- `server/tests/alerts.test.ts`

**Step 3: Update helpers.ts**

Remove the `TEST_AUTH_TOKEN` and `authHeader` exports (no longer needed).

**Step 4: Run tests**

```bash
cd ~/projects/niche-inventory/server
bun run test
```

Expected: all tests pass with JWT auth.

**Step 5: Commit**

```bash
git add server/tests/setup.ts server/tests/helpers.ts server/tests/*.test.ts
git commit -m "test(auth): update tests to use JWT tokens"
```

---

### Task 1.2.8: Frontend — Login page and auth state

**Objective:** Add a login page, auth context with React Query, and update apiFetch for token refresh.

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/hooks/useAuth.ts`
- Modify: `web/src/api/client.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/Layout.tsx`

**Step 1: Update api/client.ts**

Replace the entire file:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
    },
  },
});

const API_BASE = '/api';

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');

  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return data.tokens.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const makeRequest = async (token: string | null): Promise<Response> => {
    return fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  };

  let token = getAccessToken();
  let res = await makeRequest(token);

  // If 401, try refreshing token once
  if (res.status === 401 && getRefreshToken()) {
    try {
      token = await refreshAccessToken();
      res = await makeRequest(token);
    } catch {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function logout() {
  clearTokens();
  window.location.href = '/login';
}
```

**Step 2: Create useAuth hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, logout as doLogout } from '../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<User>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiFetch<{ user: User; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.tokens.accessToken);
      localStorage.setItem('refresh_token', data.tokens.refreshToken);
      qc.setQueryData(['auth', 'me'], data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      doLogout();
      qc.clear();
    },
  });
}
```

**Step 3: Create LoginPage**

```typescript
import { useState } from 'react';
import { useLogin } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Niche Inventory</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@nicheinventory.local"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {login.isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx with auth routing**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/client';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import PickListPage from './pages/PickListPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/pick-list" element={<PickListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

**Step 5: Update Layout.tsx with user info and logout**

Add to `web/src/components/Layout.tsx`:

```typescript
import { useAuth, useLogout } from '../hooks/useAuth';
import { LogOut, User } from 'lucide-react';

// Inside Layout component, add after the nav:
const { data: user } = useAuth();
const logout = useLogout();

// In the header div, add user info:
{user && (
  <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
    <span className="text-sm text-gray-600 flex items-center gap-1">
      <User size={14} /> {user.name}
    </span>
    <button
      onClick={() => logout.mutate()}
      className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition"
    >
      <LogOut size={14} /> Logout
    </button>
  </div>
)}
```

**Step 6: Commit**

```bash
git add web/src/api/client.ts web/src/hooks/useAuth.ts web/src/pages/LoginPage.tsx web/src/App.tsx web/src/components/Layout.tsx
git commit -m "feat(auth): add login page, auth hooks, and token refresh interceptor"
```

---

## 1.3 Webhook Security

### Task 1.3.1: Add webhook signature verification

**Objective:** Require and verify HMAC-SHA256 signature on incoming webhooks.

**Files:**
- Modify: `server/src/routes/webhooks.ts`
- Modify: `server/.env` (add WEBHOOK_SECRET)
- Modify: `server/tests/webhooks.test.ts` (add signature tests)

**Step 1: Update webhooks.ts with signature verification**

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createHmac } from 'crypto';
import { processWebhookOrder } from '../services/orderProcessor';
import { AppError, ErrorCode } from '../errors/app-error';

const webhookSchema = z.object({
  externalOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  shippingAddress: z.string().optional(),
  totalAmount: z.number().nonnegative(),
  source: z.string().min(1),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
});

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true; // Skip verification if no secret configured
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return signature === `sha256=${expected}`;
}

const app = new Hono();

app.post('/orders', async (c, next) => {
  const signature = c.req.header('X-Webhook-Signature');
  const body = await c.req.text();

  if (WEBHOOK_SECRET && !signature) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing X-Webhook-Signature header');
  }

  if (signature && !verifySignature(body, signature)) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid webhook signature');
  }

  // Re-parse body for zValidator
  c.req.raw = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header(),
    body: body,
  });

  await next();
}, zValidator('json', webhookSchema), async (c) => {
  const data = c.req.valid('json');
  const order = await processWebhookOrder(data);
  return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
});

export default app;
```

**Note:** The body re-parsing approach above may need adjustment based on Hono's request API. An alternative is to validate manually after signature check:

```typescript
app.post('/orders', async (c) => {
  const signature = c.req.header('X-Webhook-Signature');
  const bodyText = await c.req.text();

  if (WEBHOOK_SECRET && !signature) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing X-Webhook-Signature header');
  }

  if (signature && !verifySignature(bodyText, signature)) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid webhook signature');
  }

  const data = webhookSchema.safeParse(JSON.parse(bodyText));
  if (!data.success) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid request body', { issues: data.error.issues });
  }

  const order = await processWebhookOrder(data.data);
  return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
});
```

Use the second approach (manual validation after signature check) — it's cleaner.

**Step 2: Add WEBHOOK_SECRET to .env**

Add to `server/.env`:
```
WEBHOOK_SECRET=whsec_niche_inventory_2026
```

**Step 3: Update webhook tests**

Add a test for missing signature:

```typescript
test('POST /orders rejects missing signature when WEBHOOK_SECRET is set', async () => {
  // Temporarily set secret for this test
  const originalSecret = process.env.WEBHOOK_SECRET;
  process.env.WEBHOOK_SECRET = 'test-secret';

  const res = await app.request('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalOrderId: 'SIG-001',
      customerName: 'Test',
      customerEmail: 'test@example.com',
      totalAmount: 10,
      source: 'test',
      items: [{ sku: 'TEST-001', quantity: 1, unitPrice: 10 }],
    }),
  });

  expect(res.status).toBe(401);
  process.env.WEBHOOK_SECRET = originalSecret;
});
```

**Step 4: Run webhook tests**

```bash
cd ~/projects/niche-inventory/server
bun test tests/webhooks.test.ts
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add server/src/routes/webhooks.ts server/.env server/tests/webhooks.test.ts
git commit -m "feat(webhooks): add HMAC-SHA256 signature verification"
```

---

## 1.4 Transaction Safety

### Task 1.4.1: Wrap order status update in transaction with optimistic locking

**Objective:** Make `PATCH /api/orders/:id/status` atomic and race-condition-safe.

**Files:**
- Modify: `server/src/routes/orders.ts`
- Modify: `server/src/entities/InventoryLevel.ts` (add version column)

**Step 1: Add version column to InventoryLevel**

```typescript
// In server/src/entities/InventoryLevel.ts, add:
import { VersionColumn } from 'typeorm';

// Inside the class:
@VersionColumn()
version: number;
```

**Step 2: Rewrite orders.ts status patch with transaction**

Replace the `PATCH /:id/status` handler:

```typescript
app.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!order) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
    }

    const oldStatus = order.status;
    order.status = status;
    await manager.save(order);

    // Handle stock release based on status change
    if (status === OrderStatus.PACKED || status === OrderStatus.SHIPPED || status === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        if (!item.variant) continue;

        // Read inventory level inside transaction with lock
        const level = await manager.findOne(InventoryLevel, {
          where: { variantId: item.variant.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!level) continue;

        if (status === OrderStatus.PACKED) {
          level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
        } else if (status === OrderStatus.SHIPPED) {
          level.quantity = Math.max(0, level.quantity - item.quantity);
          level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
        } else if (status === OrderStatus.CANCELLED) {
          level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
          level.quantity += item.quantity;
        }
        await manager.save(level);
      }
    }

    const audit = manager.create(AuditLog, {
      action: AuditAction.UPDATE_ORDER_STATUS,
      entityType: 'order',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status },
      notes: `Order status changed from ${oldStatus} to ${status}`,
    });
    await manager.save(audit);

    return await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });
  });

  return c.json(result);
});
```

**Step 3: Run order tests**

```bash
cd ~/projects/niche-inventory/server
bun test tests/orders.test.ts
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add server/src/entities/InventoryLevel.ts server/src/routes/orders.ts
git commit -m "feat(orders): wrap status update in transaction with pessimistic locking"
```

---

## 1.5 Database Migrations

### Task 1.5.1: Install TypeORM CLI and configure migrations

**Objective:** Set up TypeORM migration commands and generate baseline migration.

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/data-source.ts`

**Step 1: Add migration scripts to package.json**

```json
{
  "scripts": {
    "db:migrate": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
    "db:migrate:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts",
    "db:migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
    "db:migration:create": "typeorm-ts-node-commonjs migration:create"
  }
}
```

**Step 2: Update data-source.ts for migrations**

Ensure `migrations` path is correct:

```typescript
migrations: [__dirname + '/migrations/**/*.ts'],
```

**Step 3: Install ts-node for CLI**

```bash
cd ~/projects/niche-inventory/server
bun add -d ts-node
```

**Step 4: Generate baseline migration**

First, ensure the database schema is synced (dev mode), then generate:

```bash
cd ~/projects/niche-inventory/server
bun run db:sync
bun run db:migration:generate src/migrations/BaselineMigration
```

This creates `server/src/migrations/<timestamp>-BaselineMigration.ts`.

**Step 5: Set synchronize: false in production**

In `server/src/data-source.ts`, the current logic is already:
```typescript
synchronize: process.env.NODE_ENV !== 'production',
```

This is correct. Ensure Docker sets `NODE_ENV=production`.

**Step 6: Commit**

```bash
git add server/package.json server/src/migrations/
git commit -m "feat(db): add TypeORM migration setup and baseline migration"
```

---

### Task 1.5.2: Run migrations in Docker entrypoint

**Objective:** Ensure migrations run before the server starts in Docker.

**Files:**
- Create: `server/entrypoint.sh`
- Modify: `server/Dockerfile`

**Step 1: Create entrypoint script**

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts

echo "Seeding admin user if needed..."
bun run src/scripts/seed-admin.ts || true

echo "Starting server..."
exec npx tsx src/index.ts
```

**Step 2: Update Dockerfile**

```dockerfile
FROM node:22-slim AS deps
WORKDIR /app/server
COPY server/package.json ./
RUN npm install @hono/node-server && npm install

FROM node:22-slim
WORKDIR /app/server
COPY --from=deps /app/server/node_modules ./node_modules
COPY server/src/ ./src/
COPY server/tsconfig.json ./
COPY server/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 3002
ENV PORT=3002
ENV NODE_ENV=production
CMD ["./entrypoint.sh"]
```

**Step 3: Commit**

```bash
git add server/entrypoint.sh server/Dockerfile
git commit -m "feat(docker): run migrations and seed on container startup"
```

---

## 1.6 Infrastructure Hardening

### Task 1.6.1: Move secrets to .env and add .env.example

**Objective:** Extract all hardcoded secrets from docker-compose into .env files.

**Files:**
- Create: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `server/.env` (already exists, verify)

**Step 1: Create .env.example**

```
# Database
DATABASE_URL=postgresql://postgres:niche_inv_2026@db:5432/niche_inventory

# Server
PORT=3002
JWT_SECRET=change-this-to-a-long-random-string-in-production

# Webhook
WEBHOOK_SECRET=whsec_niche_inventory_2026

# Admin seed
ADMIN_EMAIL=admin@nicheinventory.local
ADMIN_PASSWORD=change-me-immediately

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

**Step 2: Update docker-compose.yml**

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
    env_file:
      - .env
    environment:
      POSTGRES_DB: niche_inventory
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-niche_inv_2026}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3002:3002"

  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M
    depends_on:
      - server
    ports:
      - "80:80"

volumes:
  pgdata:
```

**Step 3: Commit**

```bash
git add .env.example docker-compose.yml
git commit -m "infra: move secrets to .env, add resource limits and restart policies"
```

---

### Task 1.6.2: Harden nginx configuration

**Objective:** Add security headers, gzip, body size limits, and caching.

**Files:**
- Modify: `web/nginx.conf`

**Step 1: Update nginx.conf**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 10m;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;

    # API proxy
    location /api/ {
        proxy_pass http://server:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook proxy
    location /webhooks/ {
        proxy_pass http://server:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location = /health {
        proxy_pass http://server:3002;
    }

    # Static assets — long cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # index.html — no cache
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Step 2: Commit**

```bash
git add web/nginx.conf
git commit -m "infra(nginx): add security headers, gzip, caching, and body size limits"
```

---

### Task 1.6.3: Make CORS configurable

**Objective:** Replace hardcoded CORS origins with env-driven configuration.

**Files:**
- Modify: `server/src/index.ts`

**Step 1: Update CORS in index.ts**

Replace line 6:

```typescript
// OLD:
app.use(cors({ origin: ['http://localhost:5174', 'http://localhost:5173'] }));

// NEW:
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));
```

**Step 2: Commit**

```bash
git add server/src/index.ts
git commit -m "infra: make CORS origins configurable via ALLOWED_ORIGINS env var"
```

---

## 1.7 Audit Log Viewer

### Task 1.7.1: Create audit log API routes

**Objective:** Add paginated, filterable audit log endpoints.

**Files:**
- Create: `server/src/routes/auditLogs.ts`

**Step 1: Write audit log routes**

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';

const auditRepo = () => AppDataSource.getRepository(AuditLog);

const listQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 25;
    return Math.min(Math.max(n, 1), 100);
  }),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  performedBy: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const app = new Hono();

app.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { page, limit, entityType, entityId, action, performedBy, from, to } = c.req.valid('query');

  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (action) where.action = action;
  if (performedBy) where.performedBy = performedBy;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await auditRepo().findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return c.json({
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const log = await auditRepo().findOne({ where: { id } });
  if (!log) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'Audit log not found');
  }
  return c.json(log);
});

export default app;
```

**Step 2: Register in index.ts**

Add after other API routes:
```typescript
import auditLogsRoute from './routes/auditLogs';
// ...
app.route('/api/audit-logs', auditLogsRoute);
```

**Step 3: Commit**

```bash
git add server/src/routes/auditLogs.ts server/src/index.ts
git commit -m "feat(audit): add paginated audit log API with filters"
```

---

### Task 1.7.2: Create frontend audit log page

**Objective:** Add an audit log viewer page with table, filters, and pagination.

**Files:**
- Create: `web/src/hooks/useAuditLogs.ts`
- Create: `web/src/pages/AuditLogsPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/Layout.tsx`

**Step 1: Create useAuditLogs hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogResponse {
  data: AuditLog[];
  pagination: AuditLogPagination;
}

export function useAuditLogs(filters: {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.action) params.set('action', filters.action);
  if (filters.performedBy) params.set('performedBy', filters.performedBy);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => apiFetch<AuditLogResponse>(`/audit-logs?${params.toString()}`),
  });
}
```

**Step 2: Create AuditLogsPage**

```typescript
import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { ChevronLeft, ChevronRight, Loader2, ClipboardList } from 'lucide-react';

const ACTIONS = ['create', 'update', 'delete', 'adjust_stock', 'create_order', 'update_order_status'];
const ENTITY_TYPES = ['product', 'variant', 'inventory', 'order', 'location'];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    performedBy: '',
  });

  const { data, isLoading } = useAuditLogs({ page, limit, ...filters });
  const logs = data?.data || [];
  const pagination = data?.pagination;

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Audit Logs</h2>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.entityType}
            onChange={(e) => updateFilter('entityType', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={(e) => updateFilter('action', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            value={filters.performedBy}
            onChange={(e) => updateFilter('performedBy', e.target.value)}
            placeholder="Performed by..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={28} />
          <span className="ml-2 text-gray-500">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <ClipboardList className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No audit logs found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.entityId}</td>
                    <td className="px-4 py-3 text-gray-600">{log.performedBy || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.notes || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Update App.tsx**

Add route:
```typescript
import AuditLogsPage from './pages/AuditLogsPage';
// ...
<Route path="/audit-logs" element={<AuditLogsPage />} />
```

**Step 4: Update Layout.tsx nav**

Add nav link:
```typescript
import { ClipboardList } from 'lucide-react';
// ...
<NavLink to="/audit-logs" className={linkClass}>
  <ClipboardList size={16} /> Audit Logs
</NavLink>
```

**Step 5: Commit**

```bash
git add web/src/hooks/useAuditLogs.ts web/src/pages/AuditLogsPage.tsx web/src/App.tsx web/src/components/Layout.tsx
git commit -m "feat(audit): add audit log viewer page with filters and pagination"
```

---

## Final Verification

After all tasks are complete, run the full verification:

```bash
cd ~/projects/niche-inventory

# Server tests
cd server
bun run test

# Build web
cd ../web
bun run build

# Docker build
cd ..
docker compose build

# Check git status
git log --oneline -20
```

Expected:
- All 44+ server tests pass
- Web build succeeds
- Docker images build without errors
- Clean git history with one commit per task

---

## Summary of Changes

| Sub-Phase | Files Created | Files Modified | Tests Updated |
|-----------|--------------|----------------|---------------|
| 1.1 Error Handling | `errors/app-error.ts`, `middleware/error-handler.ts` | `index.ts`, `webhooks.ts`, `orderProcessor.ts`, all routes | `webhooks.test.ts`, all route tests |
| 1.2 Authentication | `entities/User.ts`, `services/auth.ts`, `routes/auth.ts`, `middleware/jwt-auth.ts`, `scripts/seed-admin.ts`, `web/src/hooks/useAuth.ts`, `web/src/pages/LoginPage.tsx` | `data-source.ts`, `index.ts`, `package.json`, `web/src/api/client.ts`, `web/src/App.tsx`, `web/src/components/Layout.tsx` | `setup.ts`, `helpers.ts`, all test files |
| 1.3 Webhook Security | — | `routes/webhooks.ts`, `.env` | `webhooks.test.ts` |
| 1.4 Transaction Safety | — | `entities/InventoryLevel.ts`, `routes/orders.ts` | `orders.test.ts` |
| 1.5 DB Migrations | `migrations/*`, `entrypoint.sh` | `package.json`, `data-source.ts`, `Dockerfile` | — |
| 1.6 Infrastructure | `.env.example` | `docker-compose.yml`, `nginx.conf`, `index.ts` | — |
| 1.7 Audit Logs | `routes/auditLogs.ts`, `web/src/hooks/useAuditLogs.ts`, `web/src/pages/AuditLogsPage.tsx` | `index.ts`, `App.tsx`, `Layout.tsx` | — |
