# Phase 7 — Polish & Scale Implementation Plan

> **For Hermes:** Use opencode-orchestration to implement this plan. Dispatch parallel tmux sessions per wave.

**Goal:** Make niche-inventory professional-grade — structured logging, API docs, seed script, CI/CD, dark mode, lazy routes, README.

**Architecture:** Server gets structured JSON logging (pino) + request middleware + Swagger UI. Frontend gets React.lazy route splitting + dark mode (Tailwind `dark:`) + keyboard shortcuts. Dev gets seed script + README + CI pipeline.

**Tech Stack:** pino (structured logging), @hono/swagger-ui, @tanstack/react-virtual, Tailwind dark mode, GitHub Actions.

**Scoping decisions:**
- **INCLUDE:** 7.1 CI/CD, 7.2 Logging (core — pino + request middleware, skip Prometheus/Sentry/Loki), 7.3 Performance (lazy routes + indexes + column projection, skip Redis/virtual scroll), 7.5 API Docs, 7.6 DX (seed script, .env.example update, README, skip CONTRIBUTING.md + monorepo tooling), 7.7 Frontend Extras (dark mode + keyboard shortcuts, skip PWA + i18n)
- **SKIP:** 7.4 Database Backups (infrastructure task, not code — add pg_dump script but skip WAL/verification), Redis caching, Sentry, i18n, PWA, monorepo tooling

---

## Wave 1 — Server Infrastructure (parallel: 2 sessions)

### Session A: Structured Logging (7.2 core)

**Objective:** Replace console.log with pino structured JSON logging + add request logging middleware.

**Files:**
- Create: `server/src/utils/logger.ts`
- Modify: `server/src/middleware/error-handler.ts`
- Create: `server/src/middleware/request-logger.ts`
- Modify: `server/src/index.ts`

**Tasks:**

1. Install pino + pino-pretty (dev): `cd server && bun add pino && bun add -d pino-pretty`
2. Create `server/src/utils/logger.ts`:
```ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
```
3. Create `server/src/middleware/request-logger.ts` — Hono middleware that logs method, path, status, duration (ms), userId (from JWT if present):
```ts
import type { MiddlewareHandler } from 'hono';
import { logger } from '../utils/logger';

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const userId = c.get('jwtPayload')?.sub || null;
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    userId,
  }, `${c.req.method} ${c.req.path}`);
};
```
4. Modify `server/src/index.ts`: import + use requestLogger BEFORE routes. Replace `console.log/error` with logger calls (3 occurrences: "Database connected", "Server running", "Failed to start").
5. Modify `server/src/middleware/error-handler.ts`: replace `console.error` with `logger.error`.
6. Run existing tests: `cd server && bun test tests/*.test.ts` — all should pass. No test changes needed since logging is cosmetic.

### Session B: API Documentation (7.5)

**Objective:** Add Swagger UI at `/docs` with auto-generated OpenAPI spec.

**Files:**
- Modify: `server/src/index.ts`
- Create: `server/src/utils/openapi.ts`

**Tasks:**

1. Install: `cd server && bun add @hono/swagger-ui`
2. Create `server/src/utils/openapi.ts`:
```ts
import { swaggerUI } from '@hono/swagger-ui';

export function setupDocs(app: any) {
  // Serve Swagger UI at /docs
  app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }));

  // Generate OpenAPI spec
  app.get('/docs/openapi.json', (c: any) => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Niche Inventory API', version: '1.0.0', description: 'Inventory management system API' },
      servers: [{ url: '/', description: 'Current server' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
      paths: {} as Record<string, any>,
      tags: [
        { name: 'Auth', description: 'Authentication' },
        { name: 'Products', description: 'Product management' },
        { name: 'Inventory', description: 'Inventory levels' },
        { name: 'Orders', description: 'Order management' },
        { name: 'Locations', description: 'Warehouse locations' },
        { name: 'Transfers', description: 'Stock transfers' },
        { name: 'Stocktakes', description: 'Stock counts' },
        { name: 'Pick List', description: 'Picking operations' },
        { name: 'Alerts', description: 'Low stock alerts' },
        { name: 'Audit Logs', description: 'Activity audit trail' },
        { name: 'Reports', description: 'Business reports' },
        { name: 'Notifications', description: 'User notifications' },
        { name: 'Webhooks', description: 'Webhook configurations' },
        { name: 'Users', description: 'User management (admin)' },
        { name: 'Suppliers', description: 'Supplier management' },
        { name: 'Purchase Orders', description: 'Purchase order management' },
        { name: 'Returns', description: 'Return management' },
        { name: 'Bulk', description: 'Bulk operations' },
      ],
    };

    // Auto-document routes from the app's routes
    // Hono doesn't have built-in spec generation, so we manually list endpoints
    const routes: Array<{ method: string; path: string; summary: string; tag: string; auth?: boolean }> = [
      { method: 'post', path: '/auth/login', summary: 'Login with email/password', tag: 'Auth', auth: false },
      { method: 'post', path: '/auth/refresh', summary: 'Refresh access token', tag: 'Auth', auth: false },
      { method: 'post', path: '/auth/logout', summary: 'Logout and invalidate token', tag: 'Auth', auth: false },
      { method: 'get', path: '/auth/me', summary: 'Get current user', tag: 'Auth', auth: false },
      { method: 'patch', path: '/auth/profile', summary: 'Update current user profile', tag: 'Auth', auth: false },
      { method: 'get', path: '/api/products', summary: 'List products', tag: 'Products' },
      { method: 'post', path: '/api/products', summary: 'Create product', tag: 'Products' },
      { method: 'get', path: '/api/products/{id}', summary: 'Get product by ID', tag: 'Products' },
      { method: 'put', path: '/api/products/{id}', summary: 'Update product', tag: 'Products' },
      { method: 'delete', path: '/api/products/{id}', summary: 'Delete product', tag: 'Products' },
      { method: 'post', path: '/api/products/{id}/images', summary: 'Upload product image', tag: 'Products' },
      { method: 'get', path: '/api/inventory', summary: 'List inventory levels', tag: 'Inventory' },
      { method: 'post', path: '/api/inventory/adjust', summary: 'Adjust inventory quantity', tag: 'Inventory' },
      { method: 'get', path: '/api/orders', summary: 'List orders', tag: 'Orders' },
      { method: 'post', path: '/api/orders', summary: 'Create order', tag: 'Orders' },
      { method: 'get', path: '/api/orders/{id}', summary: 'Get order by ID', tag: 'Orders' },
      { method: 'patch', path: '/api/orders/{id}/status', summary: 'Update order status', tag: 'Orders' },
      { method: 'get', path: '/api/locations', summary: 'List locations', tag: 'Locations' },
      { method: 'post', path: '/api/locations', summary: 'Create location', tag: 'Locations' },
      { method: 'put', path: '/api/locations/{id}', summary: 'Update location', tag: 'Locations' },
      { method: 'delete', path: '/api/locations/{id}', summary: 'Delete location', tag: 'Locations' },
      { method: 'get', path: '/api/transfers', summary: 'List transfers', tag: 'Transfers' },
      { method: 'post', path: '/api/transfers', summary: 'Create transfer', tag: 'Transfers' },
      { method: 'patch', path: '/api/transfers/{id}/status', summary: 'Update transfer status', tag: 'Transfers' },
      { method: 'get', path: '/api/stocktakes', summary: 'List stocktakes', tag: 'Stocktakes' },
      { method: 'post', path: '/api/stocktakes', summary: 'Create stocktake', tag: 'Stocktakes' },
      { method: 'patch', path: '/api/stocktakes/{id}/complete', summary: 'Complete stocktake', tag: 'Stocktakes' },
      { method: 'get', path: '/api/pick-list', summary: 'Get pick list', tag: 'Pick List' },
      { method: 'patch', path: '/api/pick-list/{id}/pick', summary: 'Mark item as picked', tag: 'Pick List' },
      { method: 'get', path: '/api/alerts', summary: 'Get low stock alerts', tag: 'Alerts' },
      { method: 'get', path: '/api/audit-logs', summary: 'List audit logs', tag: 'Audit Logs' },
      { method: 'get', path: '/api/reports/inventory-value', summary: 'Inventory value report', tag: 'Reports' },
      { method: 'get', path: '/api/reports/movement', summary: 'Stock movement report', tag: 'Reports' },
      { method: 'get', path: '/api/notifications', summary: 'List notifications', tag: 'Notifications' },
      { method: 'patch', path: '/api/notifications/{id}/read', summary: 'Mark notification as read', tag: 'Notifications' },
      { method: 'post', path: '/api/webhooks/config', summary: 'Create webhook config', tag: 'Webhooks' },
      { method: 'get', path: '/api/users', summary: 'List users', tag: 'Users' },
      { method: 'post', path: '/api/users', summary: 'Create user', tag: 'Users' },
      { method: 'get', path: '/api/suppliers', summary: 'List suppliers', tag: 'Suppliers' },
      { method: 'post', path: '/api/suppliers', summary: 'Create supplier', tag: 'Suppliers' },
      { method: 'get', path: '/api/purchase-orders', summary: 'List purchase orders', tag: 'Purchase Orders' },
      { method: 'post', path: '/api/purchase-orders', summary: 'Create purchase order', tag: 'Purchase Orders' },
      { method: 'get', path: '/api/returns', summary: 'List returns', tag: 'Returns' },
      { method: 'post', path: '/api/returns', summary: 'Create return', tag: 'Returns' },
      { method: 'post', path: '/api/bulk/adjust', summary: 'Bulk inventory adjustment', tag: 'Bulk' },
      { method: 'get', path: '/health', summary: 'Health check', tag: 'Auth', auth: false },
    ];

    for (const route of routes) {
      const pathKey = route.path.replace(/{(\w+)}/g, '{$1}');
      if (!spec.paths[pathKey]) spec.paths[pathKey] = {};
      spec.paths[pathKey][route.method] = {
        summary: route.summary,
        tags: [route.tag],
        security: route.auth === false ? [] : [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Successful response' },
          '401': { description: 'Unauthorized' },
        },
      };
    }

    return c.json(spec);
  });
}
```
3. In `server/src/index.ts`, add `import { setupDocs } from './utils/openapi';` and call `setupDocs(app);` before the auth middleware.
4. Run tests to verify nothing breaks.

---

## Wave 2 — Frontend Polish (parallel: 2 sessions)

### Session C: Lazy Routes + Keyboard Shortcuts (7.3 frontend + 7.7 shortcuts)

**Objective:** Lazy load all page components with React.lazy + Suspense. Add keyboard shortcuts (/, n, Esc).

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/components/LoadingFallback.tsx`
- Create: `web/src/hooks/useKeyboardShortcuts.ts`

**Tasks:**

1. Create `web/src/components/LoadingFallback.tsx` — a nice spinner/skeleton component:
```tsx
export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
```
2. Modify `web/src/App.tsx`: Replace all static page imports with React.lazy:
```tsx
import { lazy, Suspense } from 'react';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
// ... etc for all pages
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
```
Wrap Routes content in `<Suspense fallback={<LoadingFallback />}>`.
3. Create `web/src/hooks/useKeyboardShortcuts.ts`:
```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === '/') {
        e.preventDefault();
        // Focus search if available — dispatch custom event
        document.dispatchEvent(new CustomEvent('focus-search'));
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        navigate('/products?new=true');
      }
      if (e.key === 'Escape') {
        // Close any open modal
        document.dispatchEvent(new CustomEvent('close-modals'));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
```
4. Add `useKeyboardShortcuts()` call in `Layout.tsx` component body.
5. Verify: `cd web && npx tsc --noEmit` should pass.

### Session D: Dark Mode (7.7 dark mode)

**Objective:** Add dark mode toggle using TailwindCSS `dark:` prefix with localStorage persistence.

**Files:**
- Modify: `web/src/index.css` (add `darkMode: 'class'` to tailwind config OR configure in tailwind.config)
- Modify: `web/tailwind.config.js` (if exists, add `darkMode: 'class'`)
- Modify: `web/src/components/Layout.tsx` (add dark mode toggle in header)
- Create: `web/src/hooks/useDarkMode.ts`
- Modify: `web/src/main.tsx` (apply dark class on init to prevent flash)

**Tasks:**

1. Check if `web/tailwind.config.js` or `web/tailwind.config.ts` exists. Add `darkMode: 'class'` to config.
2. Create `web/src/hooks/useDarkMode.ts`:
```tsx
import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dark-mode', String(dark));
  }, [dark]);

  const toggle = () => setDark(prev => !prev);
  return { dark, toggle };
}
```
3. In `web/src/main.tsx`, add a script that reads localStorage before React renders (prevents flash of wrong theme):
```tsx
// Add before the React root render:
const savedDark = localStorage.getItem('dark-mode');
if (savedDark === 'true' || (!savedDark && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}
```
4. Add dark mode toggle button in `Layout.tsx` header (sun/moon icon next to notifications). Import Moon/Sun from lucide-react.
5. Add dark: variants to key components:
   - `Layout.tsx`: header `bg-white dark:bg-gray-900 border-b dark:border-gray-800`, nav link colors, main bg `bg-gray-50 dark:bg-gray-950`
   - This is the baseline — other pages inherit from Tailwind's dark: utilities. Just ensure the foundation classes exist.
6. Verify: `cd web && npx tsc --noEmit` should pass.

---

## Wave 3 — DX + CI (parallel: 2 sessions)

### Session E: Seed Script + README (7.6)

**Objective:** Add comprehensive seed script + full README + update .env.example.

**Files:**
- Modify: `server/src/scripts/seed.ts` (create if not exists, the seed-admin.ts already exists)
- Modify: `.env.example`
- Create: `README.md`
- Modify: `server/package.json` (add seed script)
- Create: `scripts/backup.sh` (pg_dump script for 7.4)

**Tasks:**

1. Create `server/src/scripts/seed.ts` — comprehensive demo data seeder:
   - Read existing `seed-admin.ts` for the admin creation pattern
   - Seed: 5 products (with variants), 3 locations, 20 inventory levels, 10 orders, 5 suppliers, 3 purchase orders
   - Make it idempotent (check if data exists, skip if so)
   - Add to package.json: `"db:seed": "bun run src/scripts/seed.ts"`
2. Update `.env.example` — add all missing vars: LOG_LEVEL, NODE_ENV, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, UPLOAD_DIR
3. Create `README.md` with sections:
   - Project overview + screenshot placeholder
   - Features list (all completed phases)
   - Tech stack
   - Prerequisites (Docker, Bun)
   - Quick Start (docker-compose up)
   - Local Development (without Docker)
   - Environment Variables (table)
   - API Documentation (`/docs` endpoint)
   - Project Structure
   - Testing (`bun test`)
   - Deployment
4. Create `scripts/backup.sh` — simple pg_dump wrapper:
```bash
#!/bin/bash
# Daily DB backup script
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
FILENAME="$BACKUP_DIR/niche_inventory_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U postgres niche_inventory | gzip > "$FILENAME"
# Keep last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "Backup saved: $FILENAME"
```
5. Run the seed script to verify it works: `cd server && bun run src/scripts/seed.ts`

### Session F: CI/CD Pipeline (7.1)

**Objective:** GitHub Actions for PR checks + Docker image builds.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/docker.yml`
- Modify: `.gitignore` (add .env, backups/)

**Tasks:**

1. Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  server-checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: niche_inventory_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: cd server && bun install
      - run: cd server && npx tsc --noEmit
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/niche_inventory_test
          JWT_SECRET: ci-test-secret
          NODE_ENV: test
      - run: cd server && bun test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/niche_inventory_test
          JWT_SECRET: ci-test-secret
          WEBHOOK_SECRET: ci-test-whsec
          ADMIN_EMAIL: admin@test.com
          ADMIN_PASSWORD: testpass123
          NODE_ENV: test

  web-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: cd web && bun install
      - run: cd web && npx tsc --noEmit
      - run: cd web && bun run build
```

2. Create `.github/workflows/docker.yml`:
```yaml
name: Docker Build
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/') }}
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

3. Update `.gitignore`: add `backups/` and `uploads/` directories.

---

## Wave 4 — Performance + DB Indexes (1 session)

### Session G: Database Indexes + Column Projection (7.3 server)

**Objective:** Add DB indexes on frequently queried columns. Optimize SELECT projections on list endpoints.

**Files:**
- Create: `server/src/migrations/AddIndexes.ts` (TypeORM migration)
- Modify: list route handlers to use `select` where beneficial

**Tasks:**

1. Create a TypeORM migration that adds indexes:
   - `orders.status` (filtering by status)
   - `orders."createdAt"` (sorting by date)
   - `inventory_levels."productId"` (lookups)
   - `inventory_levels."locationId"` (filtering)
   - `products."sku"` (search)
   - `audit_logs."createdAt"` (sorting)
   - `transfers.status` (filtering)
   - `stocktakes.status` (filtering)
   - `notifications."userId"` (filtering) + `read` (filtering)
   
   Use the existing migration pattern from `server/src/migrations/`.

2. Add `select` projections to key list endpoints (products list, inventory list, orders list) — exclude large text columns and blobs where not needed.

3. Run tests to verify nothing breaks.

---

## Post-Integration Review

After all waves complete:
1. Run full test suite: `cd server && bun test tests/*.test.ts`
2. Run web build: `cd web && bun run build`
3. Run `git diff --stat` to see all changes
4. Update ROADMAP.md Phase 7 checkboxes
5. Git commit all changes
