# Niche Inventory — Production Roadmap

> Last updated: 2026-04-24
> Project: ~/projects/niche-inventory
> Stack: Hono + TypeORM + PostgreSQL (server), React + Vite + TailwindCSS (web), Docker + nginx
> Current state: Phase 5 complete — 123 integration tests, RBAC + User Management, responsive UI, Docker deployment

---

## Phase 1 — Foundation & Security (Est: 1–2 weeks)

> Goal: Make it safe to deploy and use with real data. No new features — just harden what exists.

### 1.1 Authentication System
- [ ] Replace static Bearer token with JWT (access + refresh tokens)
- [ ] Add `User` entity: id, email, passwordHash, name, role (admin/manager/warehouse), createdAt, lastLogin
- [ ] Add `POST /api/auth/login` — email + password → JWT pair
- [ ] Add `POST /api/auth/refresh` — refresh token → new access token
- [ ] Add `POST /api/auth/logout` — invalidate refresh token
- [ ] Add `GET /api/auth/me` — return current user
- [ ] Auth middleware reads JWT from `Authorization: Bearer` header (keep Bearer format)
- [ ] Add bcrypt for password hashing (`bcryptjs` — pure JS, no native deps)
- [ ] Seed script: create default admin user on first run
- [ ] Frontend: Login page, auth state in React Query, token refresh interceptor in `apiFetch`
- [ ] Remove `DEFAULT_AUTH_TOKEN` hardcoded fallback from `client.ts`

### 1.2 Webhook Security
- [ ] Add webhook secret config (`WEBHOOK_SECRET` env var)
- [ ] Require `X-Webhook-Signature: sha256=<hex>` header on `POST /webhooks/orders`
- [ ] Verify HMAC-SHA256 of request body against secret
- [ ] Return 401 on signature mismatch
- [ ] Add per-source secrets support (shopify_secret, etsy_secret, etc.)

### 1.3 Transaction Safety
- [ ] Wrap `PATCH /api/orders/:id/status` handler in `AppDataSource.transaction()`
- [ ] Move inventory level reads inside the transaction (currently outside — stale reads possible)
- [ ] Add optimistic locking on inventory levels (version column or `WHERE quantity = expected`)

### 1.4 Database Migrations
- [ ] Run `typeorm migration:generate` to capture current schema as baseline migration
- [ ] Set `synchronize: false` in production, `synchronize: true` only in dev
- [ ] Add `npm run db:migrate` and `npm run db:migrate:revert` scripts
- [ ] Run migrations as part of Docker server entrypoint (before app start)
- [ ] Add migration CI step (generate + check for uncommitted changes)

### 1.5 Error Handling Standardization
- [ ] Create `AppError` class with `statusCode`, `code`, `message`, `details?`
- [ ] Create error codes enum: `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INSUFFICIENT_STOCK`, `INTERNAL_ERROR`
- [ ] Global error handler maps `AppError` to structured JSON response: `{ error: { code, message, details } }`
- [ ] Replace all `c.json({ error: string }, status)` with `throw new AppError(...)`
- [ ] Remove fragile string-matching error classification in both `index.ts` and `webhooks.ts`

### 1.6 Infrastructure Hardening
- [ ] Move all secrets to `.env` file, use `env_file` in docker-compose
- [ ] Add `.env.example` with all required vars documented
- [ ] Add `restart: unless-stopped` to all services
- [ ] Add memory limits: `deploy.resources.limits.memory` (server: 512MB, db: 1GB, web: 128MB)
- [ ] Add nginx security headers:
  ```
  X-Frame-Options: DENY
  X-Content-Type-Options: nosnose
  X-XSS-Protection: 1; mode=block
  Content-Security-Policy: default-src 'self'
  Referrer-Policy: strict-origin-when-cross-origin
  ```
- [ ] Enable gzip in nginx (`gzip on; gzip_types text/plain application/json text/css application/javascript`)
- [ ] Add `client_max_body_size 10m;` to nginx
- [ ] Add caching headers for static assets (`/assets/` — 1 year, `index.html` — no-cache)
- [ ] Make CORS origin configurable via `ALLOWED_ORIGINS` env var

### 1.7 Audit Log Viewer
- [ ] Add `GET /api/audit-logs` — with pagination, filters (entityType, entityId, action, dateRange, performedBy)
- [ ] Add `GET /api/audit-logs/:id`
- [ ] Frontend: Audit log page (`/audit-logs`) with table, filters, pagination
- [ ] Add nav link to audit logs

---

## Phase 2 — Core UX & Data (Est: 2–3 weeks)

> Goal: Make day-to-day warehouse operations smooth. Focus on the pages staff use constantly.

### 2.1 Pagination (Backend + Frontend)
- [ ] Create reusable pagination helper: `parsePagination(query)` → `{ skip, take, page, limit }`
- [ ] Standardized response format for list endpoints:
  ```json
  { "data": [...], "pagination": { "page": 1, "limit": 25, "total": 142, "totalPages": 6 } }
  ```
- [ ] Add pagination to: `GET /api/products`, `GET /api/orders`, `GET /api/locations`, `GET /api/inventory`, `GET /api/audit-logs`
- [ ] Default page size: 25, max: 100
- [ ] Frontend: pagination component (prev/next + page numbers), integrate into all list views
- [ ] React Query: store `page` and `limit` in query state, invalidate on mutations

### 2.2 Search & Filtering
- [ ] Products: search by name/SKU (`ILIKE`), filter by category, filter by stock status (in_stock/low_stock/out_of_stock)
- [ ] Orders: search by externalOrderId/customerName/customerEmail, filter by status, filter by source, filter by date range
- [ ] Inventory: filter by location, filter by product, filter by low stock
- [ ] Audit logs: filter by entityType, action, date range, performedBy
- [ ] Backend: add `?search=...`, `?category=...`, `?status=...`, `?from=...&to=...` query params
- [ ] Frontend: filter bar component with debounced search input (300ms), dropdown selects, date pickers
- [ ] Persist filter state in URL search params (useSearchParams) so filters survive navigation

### 2.3 Column Sorting
- [ ] Backend: add `?sortBy=createdAt&sortDir=desc` query params to list endpoints
- [ ] Validate `sortBy` against allowed columns whitelist (prevent SQL injection on ORDER BY)
- [ ] Frontend: clickable column headers with sort direction indicator (↑↓)
- [ ] Persist sort state in URL search params

### 2.4 Locations Management Page
- [ ] Frontend: `/locations` page with CRUD table (create, edit, delete)
- [ ] Use existing `useLocations` and `useCreateLocation` hooks
- [ ] Add `useUpdateLocation` and `useDeleteLocation` hooks
- [ ] Add `GET /api/locations/:id` endpoint
- [ ] Add nav link to locations
- [ ] Show variant count per location in table

### 2.5 Variant Management
- [ ] Allow adding/removing variants on product edit (currently stripped)
- [ ] Add `POST /api/products/:id/variants` — add variant to existing product
- [ ] Add `PATCH /api/products/:productId/variants/:variantId` — edit variant
- [ ] Add `DELETE /api/products/:productId/variants/:variantId` — remove variant (cascade delete inventory levels)
- [ ] Frontend: variant editor within ProductForm — add/remove rows dynamically
- [ ] Warning when deleting variant with non-zero inventory

### 2.6 UI Polish
- [ ] Add loading skeleton components for table rows and cards
- [ ] Add React error boundary wrapper around routes (show "Something went wrong" + retry button)
- [ ] Add 404 page for unknown routes
- [ ] Add toast notification system (sonner or react-hot-toast): success (green), error (red), info (blue)
- [ ] Replace `window.confirm` delete dialogs with proper confirmation modal
- [ ] Add per-field form validation: red borders, error messages below inputs
- [ ] Add success toast after create/update/delete operations
- [ ] Add keyboard navigation: Tab through table rows, Enter to expand, Escape to close modals

### 2.7 Export
- [ ] Add `GET /api/products/export?format=csv&filters...` — server-side CSV generation
- [ ] Add `GET /api/orders/export?format=csv&filters...`
- [ ] Add `GET /api/inventory/export?format=csv&filters...`
- [ ] Use current filters/search/sort when exporting
- [ ] Frontend: "Export CSV" button on each list page
- [ ] Consider adding xlsx format via `exceljs`

---

## Phase 3 — Warehouse Operations (Est: 2–3 weeks)

> Goal: Cover the actual physical workflows — receiving, transferring, picking, counting.

### 3.1 PDF Generation
- [ ] Add `pdfkit` or `@react-pdf/renderer` for PDF generation
- [ ] Pick list PDF: grouped by location, product/variant/SKU/qty, barcode area
- [ ] Packing slip PDF: order details, items, customer address
- [ ] Invoice PDF (optional): order details + prices + tax
- [ ] Backend: `GET /api/pick-list/pdf`, `GET /api/orders/:id/packing-slip`
- [ ] Frontend: "Print" and "Download PDF" buttons on pick list and order detail
- [ ] Print-friendly CSS for browser print dialog as fallback

### 3.2 Stock Transfers Between Locations
- [ ] Add `Transfer` entity: id, fromLocationId, toLocationId, status (draft/in_transit/completed/cancelled), notes, createdBy, createdAt, completedAt
- [ ] Add `TransferItem` entity: id, transferId, variantId, quantity
- [ ] `POST /api/transfers` — create transfer (draft)
- [ ] `PATCH /api/transfers/:id/status` — advance status (draft→in_transit→completed)
- [ ] On complete: deduct from source location, add to destination location (in transaction)
- [ ] On cancel: no stock changes
- [ ] Frontend: Transfers page (`/transfers`) with create form, status tracking
- [ ] Audit log for all transfer state changes

### 3.3 Stocktake / Cycle Count
- [ ] Add `Stocktake` entity: id, locationId, status (draft/in_progress/completed), createdBy, createdAt, completedAt
- [ ] Add `StocktakeItem` entity: id, stocktakeId, variantId, systemQuantity, countedQuantity, discrepancy, notes
- [ ] `POST /api/stocktakes` — create stocktake for a location (pre-fill with current quantities)
- [ ] `PATCH /api/stocktakes/:id/items/:itemId` — update counted quantity
- [ ] `POST /api/stocktakes/:id/complete` — finalize, create stock adjustments for discrepancies
- [ ] Frontend: Stocktake page with count entry form, discrepancy highlights, completion confirmation

### 3.4 Barcode Support
- [ ] Add `barcode` field to `ProductVariant` entity (store EAN-13, UPC, or custom barcode)
- [ ] Search products/variants by barcode (via search API)
- [ ] Frontend: barcode input field on pick list page (type barcode → find item → mark as picked)
- [ ] Consider `html5-qrcode` for camera-based scanning on mobile
- [ ] Barcode display on pick list PDF

### 3.5 Bulk Operations
- [ ] Products: bulk delete (select via checkboxes)
- [ ] Orders: bulk status change (select multiple → confirm/pack/ship)
- [ ] Inventory: bulk adjust (select multiple levels → set quantity)
- [ ] Frontend: checkbox column, "select all" toggle, floating action bar with bulk action buttons
- [ ] Backend: `POST /api/products/bulk-delete`, `POST /api/orders/bulk-status`, `POST /api/inventory/bulk-adjust`

---

## Phase 4 — Business Intelligence ✅ DONE

> Goal: Give managers visibility into what's happening — sales, stock levels, trends.

### 4.1 Reports Dashboard
- [x] New page: `/reports`
- [x] KPI cards: total products, total stock value, low stock count, pending orders, orders today
- [x] Charts (recharts):
  - Stock levels by location (bar chart)
  - Orders by status (donut chart)
  - Orders over time (line chart — last 30 days)
  - Top selling products (bar chart)
- [x] Inventory valuation table
- [x] Auto-refresh every 60 seconds

### 4.2 Reporting API Endpoints
- [x] `GET /api/reports/summary` — KPI data for dashboard cards
- [x] `GET /api/reports/stock-by-location` — aggregated stock by location
- [x] `GET /api/reports/orders-over-time?from=...&to=...&groupby=day|week|month`
- [x] `GET /api/reports/top-products?limit=10&from=...&to=...`
- [x] `GET /api/reports/inventory-valuation` — stock value (qty × price per variant)

### 4.3 Notifications System
- [x] Add `Notification` entity: id, type, title, message, read, entityType, entityId, createdAt
- [ ] Low stock auto-notifications (when stock drops below threshold)
- [ ] Order status change notifications
- [x] `GET /api/notifications` — paginated, filter by read/unread
- [x] `GET /api/notifications/unread-count` — lightweight badge endpoint
- [x] `PATCH /api/notifications/:id/read` — mark as read
- [x] `PATCH /api/notifications/read-all` — mark all as read
- [x] Frontend: notification bell icon in header with unread count badge, dropdown list

### 4.4 Outgoing Webhooks
- [x] Add `WebhookConfig` entity: id, url, events[], secret, isActive, createdAt
- [x] CRUD: `GET/POST/PATCH/DELETE /api/webhooks/config`
- [x] Event types: `order.created`, `order.status_changed`, `stock.low`, `stock.adjusted`
- [x] Fire webhook service with HMAC-SHA256 signatures, async with 3-retry exponential backoff
- [x] Admin UI: webhook config page with event toggles, create/edit/delete

---

## Phase 5 — Users, Roles & Settings ✅ COMPLETE

> Goal: Multi-user support with proper access control.

### 5.1 RBAC (Role-Based Access Control)
- [x] Roles: `admin` (full access), `manager` (products, orders, inventory, reports — no users/settings), `warehouse` (pick list, stock adjustments, transfers — no products/orders)
- [x] Add `role` column to User entity
- [x] Authorization middleware: check `user.role` against required role for each route
- [x] Route-level role requirements defined as constants or decorators
- [x] Return 403 on insufficient permissions (not 401)

### 5.2 User Management
- [x] Admin-only endpoints: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`
- [x] `POST /api/auth/change-password` — self-service password change
- [ ] `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` — (optional, needs email)
- [x] Frontend: `/settings/users` page (admin only) — user table, invite/create, edit role, disable
- [x] Frontend: `/settings/profile` page — edit own name/email, change password

### 5.3 Settings Page
- [x] `/settings` — tabbed layout: Profile, Users (admin), Webhooks, API Keys
- [ ] Global settings: default low stock threshold, notification preferences, company name/address (for PDFs)

---

## Phase 6 — Integrations & Ecosystem (Est: 3–4 weeks)

> Goal: Connect to external systems — sales channels, shipping, accounting.

### 6.1 Product Images
- [ ] Add `images` JSON column to Product (array of URLs) or separate `ProductImage` entity
- [ ] Image upload endpoint: `POST /api/products/:id/images` — accept multipart, store to S3-compatible storage (OVH/S3/Cloudflare R2)
- [ ] `DELETE /api/products/:id/images/:imageId`
- [ ] Frontend: image upload dropzone in ProductForm, image gallery on product detail, thumbnail in table
- [ ] Consider `@aws-sdk/client-s3` or `tus` for resumable uploads

### 6.2 Supplier Management
- [ ] Add `Supplier` entity: id, name, contactName, email, phone, address, notes, createdAt
- [ ] Full CRUD: `GET/POST/PATCH/DELETE /api/suppliers`
- [ ] Add `supplierId` FK to Product entity
- [ ] Frontend: `/suppliers` page, supplier dropdown on product form
- [ ] Supplier detail page: linked products, lead time tracking

### 6.3 Purchase Orders
- [ ] Add `PurchaseOrder` entity: id, supplierId, status (draft/sent/partially_received/received/cancelled), notes, createdAt
- [ ] Add `PurchaseOrderItem` entity: id, poId, variantId, quantity, receivedQuantity, unitCost
- [ ] CRUD + status workflow (similar to sales orders)
- [ ] `POST /api/purchase-orders/:id/receive` — partial or full receiving, auto-adjusts inventory
- [ ] Frontend: `/purchase-orders` page, create form, receive workflow
- [ ] Auto-generate PO suggestions when stock drops below threshold

### 6.4 Shipping Integration
- [ ] Add `trackingNumber` and `shippingCarrier` fields to Order entity
- [ ] Add `trackingUrl` computed field based on carrier
- [ ] Support carriers: DHL, UPS, FedEx, USPS, Royal Mail (URL templates)
- [ ] Optional: ShipStation/EasyPost API integration for label generation
- [ ] Frontend: tracking number input on order detail, tracking link display

### 6.5 Returns / RMAs
- [ ] Add `Return` entity: id, orderId, reason, status (requested/approved/received/refunded/rejected), notes, createdAt
- [ ] Add `ReturnItem` entity: id, returnId, variantId, quantity, condition (new/damaged/used)
- [ ] On approved + received: auto-adjust inventory (add stock back)
- [ ] Frontend: `/returns` page, create from order detail, approval workflow

### 6.6 Email Notifications
- [ ] Add email service (Resend, SendGrid, or SMTP)
- [ ] Templates: low stock alert, order confirmation, shipping confirmation
- [ ] Configurable: which notifications to send, to which email addresses
- [ ] Send on relevant events via the notification system (Phase 4.3)

---

## Phase 7 — Polish & Scale (Est: 2–3 weeks)

> Goal: Make it professional-grade — performance, reliability, developer experience.

### 7.1 CI/CD
- [ ] GitHub Actions: lint → type check → test → build on PR
- [ ] GitHub Actions: build + push Docker images on merge to main
- [ ] GitHub Actions: deploy to staging on merge to main, deploy to prod on tag
- [ ] Add ESLint + Prettier config, enforce in CI
- [ ] Add `tsc --noEmit` to CI for type checking

### 7.2 Monitoring & Logging
- [ ] Structured JSON logging on server (pino or winston)
- [ ] Request logging middleware: method, path, status, duration, userId
- [ ] Docker: centralized logging driver or Loki integration
- [ ] Optional: Prometheus metrics endpoint (`/metrics`) — request count, latency histograms, error rates
- [ ] Optional: Sentry for frontend error tracking

### 7.3 Performance
- [ ] Add Redis for caching frequently accessed data (product list, low stock alerts)
- [ ] Add database connection pooling config (already via TypeORM, but tune pool size)
- [ ] Add `SELECT` column projection (don't always fetch all columns, especially for list views)
- [ ] Add database indexes on frequently queried columns (status, createdAt, SKU)
- [ ] Frontend: lazy load routes with `React.lazy` + `Suspense`
- [ ] Frontend: virtual scrolling for large tables (consider `@tanstack/react-virtual`)

### 7.4 Database Backups
- [ ] Add `pg_dump` cron job (daily at 2 AM, keep 30 days)
- [ ] Optional: WAL archiving for point-in-time recovery
- [ ] Backup verification: restore to test DB weekly
- [ ] Document backup/restore procedure in README

### 7.5 API Documentation
- [ ] Add `@hono/swagger-ui` or `scalar` for interactive API docs
- [ ] Add JSDoc/OpenAPI annotations to route handlers
- [ ] Generate OpenAPI spec automatically
- [ ] Accessible at `/docs` route

### 7.6 Developer Experience
- [ ] Add seed script (`npm run db:seed`) that creates demo data (products, locations, orders, inventory)
- [ ] Add `.env.example` with all variables documented
- [ ] Update README with: setup instructions, architecture overview, API overview, deployment guide
- [ ] Add `CONTRIBUTING.md` with code style, commit conventions, PR process
- [ ] Consider monorepo tooling (turborepo or nx) for shared types between server/web

### 7.7 Frontend Extras
- [ ] Dark mode toggle (TailwindCSS dark: prefix, localStorage preference)
- [ ] PWA manifest + service worker for offline-capable pick list
- [ ] Keyboard shortcuts: `/` to focus search, `n` for new, `Esc` to close
- [ ] Internationalization foundation (i18next) — even if English-only for now, structure for future

---

## Dependency Graph (Quick Reference)

```
Phase 1 (Security/Foundation)
  ├── 1.1 Auth → needed by Phase 5 (RBAC)
  ├── 1.4 Migrations → needed by all future schema changes
  └── 1.3 Transactions → needed by Phase 3.2 (Transfers)

Phase 2 (Core UX) — can start alongside Phase 1
  └── 2.5 Variants → needed before Phase 6.3 (Purchase Orders)

Phase 3 (Warehouse Ops) — depends on Phase 2
  └── 3.4 Barcodes → enhanced by Phase 6.1 (Product Images)

Phase 4 (Reports) — depends on Phase 2 (for data to report on)
  └── 4.4 Webhooks → depends on Phase 1.2 (Webhook Security pattern)

Phase 5 (Users) — depends on Phase 1.1 (Auth)
  └── 5.1 RBAC → needed by Phase 6 (to restrict integration features)

Phase 6 (Integrations) — depends on Phase 5 (RBAC)
  └── 6.3 Purchase Orders → depends on Phase 6.2 (Suppliers)

Phase 7 (Polish) — ongoing, can start anytime after Phase 2
```

---

## Effort Summary

| Phase | Description | Est. Time | Dependencies |
|-------|-------------|-----------|--------------|
| **1** | Foundation & Security | 1–2 weeks | None |
| **2** | Core UX & Data | 2–3 weeks | None (parallel with P1) |
| **3** | Warehouse Operations | 2–3 weeks | Phase 1, Phase 2 |
| **4** | Business Intelligence | 2 weeks | Phase 2 |
| **5** | Users, Roles & Settings | 1–2 weeks | Phase 1.1 |
| **6** | Integrations & Ecosystem | 3–4 weeks | Phase 5 |
| **7** | Polish & Scale | 2–3 weeks | Phase 2+ |

**Total estimated: ~14–20 weeks** for a single developer, or ~8–12 weeks with a small team.

---

## Quick Wins (Can be done in a day each)

These are high-impact, low-effort items that don't need a full phase:

1. [ ] Error boundary wrapper (30 min)
2. [ ] 404 page (15 min)
3. [ ] Toast notifications with sonner (1 hr)
4. [ ] Seed script (1 hr)
5. [ ] Nginx security headers + gzip (30 min)
6. [ ] `restart: unless-stopped` + memory limits in compose (15 min)
7. [ ] `.env` file support in compose (30 min)
8. [ ] Make CORS configurable (30 min)
9. [ ] Loading skeletons (2 hr)
10. [ ] Dark mode toggle (2 hr)
