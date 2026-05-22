# Niche Inventory — Full Project Analysis

> Generated: 2026-05-22
> Codebase: /root/projects/niche-inventory
> Analyzer: opencode (automated deep read of every source file)

---

## 1. Executive Summary

Niche Inventory is a full-featured, production-grade inventory management system built as a monorepo with a Hono/TypeORM/PostgreSQL backend and a React/Vite/TailwindCSS frontend. The project is at **Phase 7 (Polish & Scale)** of its roadmap, with Phases 1–6 substantially complete. It contains **20 database entities**, **19 route modules** exposing **50+ API endpoints**, **16 page components**, **20 React Query hooks**, and **6 backend service modules**. The system supports multi-warehouse inventory tracking, order lifecycle management, purchase orders, returns/RMAs, stocktakes, transfers, supplier management, barcode scanning, PDF generation, email notifications, webhook integration, RBAC, audit logging, reporting, and CSV export.

---

## 2. Architecture Overview

### 2.1 Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Bun (dev), Node.js 22 (Docker) | — |
| Backend Framework | Hono | ^4.4.0 |
| ORM | TypeORM | ^0.3.20 |
| Database | PostgreSQL | 17-alpine |
| Auth | JWT (jsonwebtoken) + bcryptjs | access 15m, refresh 7d |
| Frontend Framework | React | ^18.3.0 |
| Build Tool | Vite | ^5.2.0 |
| CSS | TailwindCSS | ^3.4.0 |
| Data Fetching | @tanstack/react-query | ^5.40.0 |
| Charts | Recharts | ^3.8.1 |
| PDF | pdfkit | ^0.18.0 |
| Email | nodemailer | ^8.0.6 |
| Logging | pino | ^10.3.1 |
| Validation | zod | ^3.23.0 |
| API Docs | @hono/swagger-ui | ^0.6.1 |
| Containerization | Docker + nginx | — |
| CI/CD | GitHub Actions | — |

### 2.2 Directory Structure

```
niche-inventory/
├── server/                     # Backend (Hono + TypeORM)
│   ├── src/
│   │   ├── entities/           # 20 TypeORM entities
│   │   ├── routes/             # 19 route modules
│   │   ├── middleware/         # 5 middleware (jwt-auth, rbac, error-handler, rate-limit, request-logger)
│   │   ├── services/           # 6 service modules (auth, orderProcessor, email, webhooks, pickList, alerts)
│   │   ├── errors/             # AppError class + ErrorCode enum
│   │   ├── utils/              # pagination, sort, csv-export, pdf, logger, helpers, openapi
│   │   ├── scripts/            # seed.ts, seed-admin.ts
│   │   ├── migrations/         # TypeORM migrations
│   │   ├── index.ts            # App entry point
│   │   ├── data-source.ts      # TypeORM DataSource config
│   │   └── preload.ts          # Preload module
│   ├── tests/                  # Integration tests
│   ├── Dockerfile              # Multi-stage Docker build
│   ├── entrypoint.sh           # Container startup (db setup + seed admin)
│   └── seed-full.ts            # Standalone demo seeder
├── web/                        # Frontend (React + Vite)
│   ├── src/
│   │   ├── api/                # API client (client.ts)
│   │   ├── hooks/              # 20 React Query hooks
│   │   ├── components/         # 16 reusable components
│   │   ├── pages/              # 16 page components
│   │   ├── utils/              # dateFormat utility
│   │   ├── types.ts            # Shared TypeScript types
│   │   ├── App.tsx             # Router + providers
│   │   └── main.tsx            # Entry point
│   ├── Dockerfile              # Multi-stage build (bun build → nginx)
│   ├── nginx.conf              # Reverse proxy + SPA serving
│   └── vite.config.ts
├── scripts/                    # backup.sh, e2e-test.sh
├── .github/workflows/          # ci.yml, docker.yml
├── docker-compose.yml          # 4 services: db, server, web, watchtower
├── docs/plans/                 # Planning documents
├── ROADMAP.md                  # 7-phase development roadmap
├── BUGS.md                     # 93-item bug audit (13 fixed, 80 open)
└── README.md                   # Setup and usage docs
```

### 2.3 Request Flow

```
Browser → nginx (port 80) → React SPA (static files)
                              ↓ API calls
         nginx /api/* proxy → Hono server (port 3002)
                              ↓
         JWT auth middleware → RBAC middleware → Route handler
                              ↓
         TypeORM → PostgreSQL 17
```

---

## 3. Data Model (Entities)

### 3.1 Entity Relationship Diagram (Conceptual)

```
User ──────────────────────────────────────────────── (auth, RBAC)
  │
  ├── Order ──┬── OrderItem ──── ProductVariant ──── Product ──── Supplier
  │           │                       │
  │           │                       ├── InventoryLevel ──── Location
  │           │                       │       │
  │           │                       │       └── StockAdjustment
  │           │                       │
  │           │                       ├── TransferItem ──── Transfer
  │           │                       ├── StocktakeItem ──── Stocktake
  │           │                       ├── ReturnItem ──── Return ──┘ (Order)
  │           │                       └── PurchaseOrderItem ──── PurchaseOrder ── Supplier
  │           │
  │           └── AuditLog (entityType + entityId polymorphic)
  │
  ├── Notification
  ├── WebhookConfig
  └── (tokenVersion for refresh token invalidation)
```

### 3.2 Entity Inventory (20 entities)

| # | Entity | Table | Primary Key | Notable Columns | Relationships |
|---|--------|-------|-------------|-----------------|---------------|
| 1 | **Product** | `products` | UUID | name, sku (unique), description, category, price (decimal 10,2), lowStockThreshold, images (simple-array), supplierId | hasMany ProductVariant, belongsTo Supplier |
| 2 | **ProductVariant** | `product_variants` | UUID | name, sku, barcode (unique, nullable), description, productId | belongsTo Product, hasMany InventoryLevel |
| 3 | **Location** | `locations` | UUID | name, type, address | hasMany InventoryLevel |
| 4 | **InventoryLevel** | `inventory_levels` | UUID | quantity, reservedQuantity, version (optimistic lock), variantId, locationId | belongsTo ProductVariant, belongsTo Location. Unique index on [variantId, locationId] |
| 5 | **Order** | `orders` | UUID | externalOrderId (unique), status (enum), customerName, customerEmail, shippingAddress, totalAmount, source, trackingNumber, shippingCarrier | hasMany OrderItem |
| 6 | **OrderItem** | `order_items` | UUID | orderId, variantId, externalSku, quantity, unitPrice | belongsTo Order, belongsTo ProductVariant |
| 7 | **User** | `users` | UUID | email (unique, indexed), passwordHash, name, role (enum), tokenVersion, lastLogin | — |
| 8 | **StockAdjustment** | `stock_adjustments` | UUID | inventoryLevelId, quantityChange, previousQuantity, newQuantity, reason (enum), notes, adjustedBy | belongsTo InventoryLevel |
| 9 | **AuditLog** | `audit_logs` | UUID | action (enum with 17 values), entityType, entityId, oldValues (jsonb), newValues (jsonb), performedBy, notes | Polymorphic |
| 10 | **Notification** | `notifications` | UUID | type (enum), title, message, read, entityType, entityId | — |
| 11 | **WebhookConfig** | `webhook_configs` | UUID | url, events (simple-array), secret, isActive | — |
| 12 | **Supplier** | `suppliers` | UUID | name, contactName, email, phone, address, notes | hasMany Product |
| 13 | **Transfer** | `transfers` | UUID | fromLocationId, toLocationId, status (enum), notes, createdBy, completedAt | hasMany TransferItem, belongsTo Location (×2) |
| 14 | **TransferItem** | `transfer_items` | UUID | transferId, variantId, quantity | belongsTo Transfer, belongsTo ProductVariant |
| 15 | **Stocktake** | `stocktakes` | UUID | locationId, status (enum), notes, createdBy, completedAt | hasMany StocktakeItem, belongsTo Location |
| 16 | **StocktakeItem** | `stocktake_items` | UUID | stocktakeId, variantId, systemQuantity, countedQuantity (nullable), discrepancy (nullable), notes | belongsTo Stocktake, belongsTo ProductVariant |
| 17 | **PurchaseOrder** | `purchase_orders` | UUID | supplierId, status (enum), notes | hasMany PurchaseOrderItem, belongsTo Supplier |
| 18 | **PurchaseOrderItem** | `purchase_order_items` | UUID | purchaseOrderId, variantId, quantity, receivedQuantity, unitCost | belongsTo PurchaseOrder, belongsTo ProductVariant |
| 19 | **Return** | `returns` | UUID | orderId, reason, status (enum), notes | hasMany ReturnItem, belongsTo Order |
| 20 | **ReturnItem** | `return_items` | UUID | returnId, variantId, quantity, condition (enum) | belongsTo Return, belongsTo ProductVariant |

### 3.3 Enums

| Enum | Values | Used By |
|------|--------|---------|
| **OrderStatus** | pending, confirmed, packed, shipped, cancelled | Order |
| **UserRole** | admin, manager, warehouse | User |
| **TransferStatus** | draft, in_transit, completed, cancelled | Transfer |
| **StocktakeStatus** | draft, in_progress, completed | Stocktake |
| **PurchaseOrderStatus** | draft, sent, partially_received, received, cancelled | PurchaseOrder |
| **ReturnStatus** | requested, approved, received, refunded, rejected | Return |
| **ReturnItemCondition** | new, damaged, used | ReturnItem |
| **AdjustmentReason** | manual, received, damaged, shrinkage, return, correction, stocktake | StockAdjustment |
| **NotificationType** | low_stock, order_status, stock_adjusted, transfer_completed, system | Notification |
| **WebhookEventType** | order.created, order.status_changed, stock.low, stock.adjusted | WebhookConfig |
| **AuditAction** | 17 values (create, update, delete, adjust_stock, create_order, etc.) | AuditLog |
| **ErrorCode** | 9 values (NOT_FOUND, VALIDATION_ERROR, UNAUTHORIZED, etc.) | AppError |

### 3.4 Database Features

- **Optimistic locking**: `InventoryLevel.version` via `@VersionColumn`
- **Unique composite index**: `InventoryLevel` on `[variantId, locationId]`
- **Cascade deletes**: Product → ProductVariant, Order → OrderItem, Transfer → TransferItem, etc.
- **RESTRICT deletes**: ProductVariant referenced by PurchaseOrderItem, TransferItem
- **synchronize: true** in dev, `synchronize: false` in production (migration-based)
- **Column-level indexes**: User.email

---

## 4. Backend API — Complete Endpoint Catalog

### 4.1 Authentication (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | None (rate-limited) | Email+password → JWT pair + user |
| POST | `/auth/refresh` | None | Refresh token → new access token |
| POST | `/auth/logout` | JWT | Increments tokenVersion (invalidates refresh) |
| GET | `/auth/me` | Bearer token | Returns current user profile |
| PATCH | `/auth/profile` | JWT | Update name/email |
| POST | `/auth/change-password` | JWT | Change password (requires current) |

### 4.2 Products (`/api/products`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List with pagination, search (name/SKU OR), barcode search, category filter, stockStatus filter, sorting |
| GET | `/api/products/export` | CSV export with filters |
| GET | `/api/products/:id` | Single product with variants + inventory |
| POST | `/api/products` | Create with optional variants + auto-create inventory levels |
| PATCH | `/api/products/:id` | Update product fields |
| DELETE | `/api/products/:id` | Delete with inventory cleanup |
| POST | `/api/products/:id/variants` | Add variant + auto-create inventory levels |
| PATCH | `/api/products/:productId/variants/:variantId` | Update variant |
| DELETE | `/api/products/:productId/variants/:variantId` | Delete variant (blocks if active stock) |
| GET | `/api/products/:id/images` | List images |
| POST | `/api/products/:id/images` | Upload image (multipart, 5MB max, jpg/png/webp/gif) |
| DELETE | `/api/products/:id/images/:index` | Delete image by index |

### 4.3 Orders (`/api/orders`) — admin, manager, warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List with pagination, search (orderId/customerName/email OR), status/source/date filters, sorting |
| GET | `/api/orders/export` | CSV export |
| GET | `/api/orders/:id` | Single order with items + variants |
| PATCH | `/api/orders/:id/status` | Status transition with state machine validation + inventory mutation (transactional with pessimistic locks) |
| GET | `/api/orders/:id/packing-slip` | Packing slip PDF |
| PATCH | `/api/orders/:id/shipping` | Set tracking number + carrier |
| GET | `/api/orders/:id/tracking-url` | Generate carrier tracking URL (DHL/UPS/FedEx/USPS/Royal Mail) |

**Order State Machine:**
```
pending → confirmed | cancelled
confirmed → packed | cancelled
packed → shipped | cancelled
shipped → (terminal)
cancelled → (terminal)
```

**Inventory mutations on status change:**
- PENDING → CANCELLED: release reserved
- CONFIRMED → PACKED: release reserved
- CONFIRMED → CANCELLED: release reserved
- PACKED → SHIPPED: deduct quantity

### 4.4 Inventory (`/api/inventory`) — admin, manager, warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory` | List with pagination, locationId/productId/lowStock filters, sorting |
| GET | `/api/inventory/export` | CSV export |
| POST | `/api/inventory/:id/adjust` | Adjust stock (transactional with pessimistic lock, validates ≥ 0 and ≥ reservedQuantity) |

### 4.5 Locations (`/api/locations`) — admin, manager, warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/locations` | List with pagination, variant count per location |
| GET | `/api/locations/:id` | Get single |
| POST | `/api/locations` | Create |
| PATCH | `/api/locations/:id` | Update |
| DELETE | `/api/locations/:id` | Delete (no dependency check) |

### 4.6 Transfers (`/api/transfers`) — admin, manager, warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transfers` | List with pagination, status/location filters, search, sorting |
| POST | `/api/transfers` | Create (validates stock availability with pessimistic locks) |
| GET | `/api/transfers/:id` | Get single with items |
| PATCH | `/api/transfers/:id/status` | Status transition (draft→in_transit→completed/cancelled). Completion deducts source + adds destination |
| DELETE | `/api/transfers/:id` | Delete draft only |

### 4.7 Stocktakes (`/api/stocktakes`) — admin, manager, warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stocktakes` | List with pagination, status/location filters, sorting |
| POST | `/api/stocktakes` | Create for location (pre-fills from current inventory) |
| GET | `/api/stocktakes/:id` | Get single with items |
| PATCH | `/api/stocktakes/:id/status` | draft→in_progress→completed. Completion adjusts inventory for discrepancies |
| PATCH | `/api/stocktakes/:id/items/:itemId` | Update counted quantity (in_progress only) |
| DELETE | `/api/stocktakes/:id` | Delete draft only |

### 4.8 Returns (`/api/returns`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/returns` | List with pagination, status/orderId filters, search |
| POST | `/api/returns` | Create return request for an order |
| GET | `/api/returns/:id` | Get single with items |
| PATCH | `/api/returns/:id/approve` | requested → approved |
| PATCH | `/api/returns/:id/reject` | requested → rejected |
| PATCH | `/api/returns/:id/receive` | approved → received (requires locationId, adds stock back) |
| PATCH | `/api/returns/:id/refund` | received → refunded |
| DELETE | `/api/returns/:id` | Delete requested only |

### 4.9 Purchase Orders (`/api/purchase-orders`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchase-orders` | List with aggregated itemCount/totalCost, status/supplier filters |
| GET | `/api/purchase-orders/:id` | Get single with items |
| POST | `/api/purchase-orders` | Create with items |
| PATCH | `/api/purchase-orders/:id` | Update notes/status (generic — allows arbitrary status) |
| POST | `/api/purchase-orders/:id/send` | draft → sent |
| POST | `/api/purchase-orders/:id/receive` | Receive items (requires locationId per item, auto-adjusts inventory) |
| POST | `/api/purchase-orders/:id/cancel` | Cancel (blocks if received) |
| DELETE | `/api/purchase-orders/:id` | Delete draft only |

### 4.10 Suppliers (`/api/suppliers`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/suppliers` | List with aggregated productCount, search |
| GET | `/api/suppliers/:id` | Get single |
| POST | `/api/suppliers` | Create |
| PATCH | `/api/suppliers/:id` | Update |
| DELETE | `/api/suppliers/:id` | Delete (blocks if products reference it) |

### 4.11 Users (`/api/users`) — admin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List with pagination |
| GET | `/api/users/:id` | Get single |
| POST | `/api/users` | Create (email uniqueness check) |
| PATCH | `/api/users/:id` | Update (admin-only role changes, can't change own role) |
| DELETE | `/api/users/:id` | Delete (can't delete self) |

### 4.12 Reports (`/api/reports`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/summary` | KPI cards: total products, total stock value, low stock count, pending orders, orders today |
| GET | `/api/reports/stock-by-location` | Aggregated stock per location |
| GET | `/api/reports/orders-over-time` | Orders grouped by day/week/month with revenue |
| GET | `/api/reports/top-products` | Top products by quantity sold |
| GET | `/api/reports/inventory-valuation` | Stock value per product (INNER JOIN on variants) |
| GET | `/api/reports/orders-by-status` | Order count grouped by status |

### 4.13 Notifications (`/api/notifications`) — all authenticated

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Paginated, filter by read/unread |
| GET | `/api/notifications/unread-count` | Badge count |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

### 4.14 Audit Logs (`/api/audit-logs`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit-logs` | Paginated, filter by entityType/entityId/action/performedBy/dateRange |
| GET | `/api/audit-logs/:id` | Get single |

### 4.15 Pick List (`/api/pick-list`) — all authenticated

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pick-list` | JSON pick list (pending orders, grouped by location) |
| GET | `/api/pick-list/pdf` | PDF pick list (grouped by location, with barcodes) |

### 4.16 Alerts (`/api/alerts`) — all authenticated

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts` | Low stock alerts (where available < threshold) |

### 4.17 Webhook Configs (`/api/webhooks/config`) — admin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhooks/config` | List (secrets masked) |
| POST | `/api/webhooks/config` | Create (SSRF protection: blocks private IPs) |
| PATCH | `/api/webhooks/config/:id` | Update |
| DELETE | `/api/webhooks/config/:id` | Delete |

### 4.18 Webhooks (Incoming) (`/webhooks`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/orders` | HMAC-SHA256 signature | Ingest external order → auto-allocate inventory across locations |

### 4.19 Bulk Operations (`/api/bulk`) — admin, manager

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bulk/products/bulk-delete` | Delete up to 100 products (checks active stock) |
| POST | `/api/bulk/orders/bulk-status` | Status change up to 100 orders (state machine enforced) |
| POST | `/api/bulk/inventory/bulk-adjust` | Adjust up to 100 inventory levels |

### 4.20 Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: 'ok' }` |

---

## 5. Backend Middleware Stack

### 5.1 JWT Auth (`jwt-auth.ts`)

- Extracts Bearer token from Authorization header
- Verifies via `jsonwebtoken`, attaches `{ userId, email, role }` to Hono context
- Throws `401 UNAUTHORIZED` if missing or invalid

### 5.2 RBAC (`rbac.ts`)

- **`requireRole(...roles)`**: Queries DB for fresh user role, validates against allowed roles
- **`requirePermission(resource)`**: Checks role's permission list against resource name
- **`ROLE_PERMISSIONS`**: Admin has `['*']`, Manager has 14 resources, Warehouse has 7 resources
- Both middleware re-fetch the user from DB (double DB lookup issue noted in BUGS.md #37)

### 5.3 Error Handler (`error-handler.ts`)

- Catches `AppError` → structured JSON `{ error: { code, message, details } }`
- Falls back to string-matching for non-AppError exceptions (fragile but functional)
- Logs all errors via pino

### 5.4 Rate Limiting (`rate-limit.ts`)

- In-memory rate limiter for login endpoint
- 10 attempts per IP per 15-minute window
- Uses `x-forwarded-for` / `x-real-ip` headers

### 5.5 Request Logger (`request-logger.ts`)

- Logs method, path, status, duration, userId for every request via pino

---

## 6. Backend Services

### 6.1 Auth Service (`auth.ts`)

- `hashPassword`: bcryptjs with 12 rounds
- `verifyPassword`: bcryptjs compare
- `generateTokens`: access (15m) + refresh (7d) with tokenVersion
- `verifyAccessToken`: Validates JWT, rejects refresh-type tokens
- `verifyRefreshToken`: Validates refresh JWT, checks tokenVersion
- `authenticateUser`: Lookup by email, verify password, update lastLogin

### 6.2 Order Processor (`orderProcessor.ts`)

- Processes incoming webhook orders
- Checks for duplicate externalOrderId
- Multi-location stock allocation: allocates from locations with most stock first
- Updates reservedQuantity for each allocated inventory level
- Creates audit log entries for each allocation
- Sends order confirmation email (fire-and-forget, before transaction commits — BUGS.md #26)

### 6.3 Email Service (`email.ts`)

- SMTP via nodemailer (configurable via env vars)
- Lazy-initialized transporter singleton
- Templates: order confirmation, shipping confirmation, low stock alert
- HTML emails with inline CSS styling
- Gracefully skips if SMTP not configured

### 6.4 Webhook Service (`webhooks.ts`)

- Fires outbound webhooks for configured events
- HMAC-SHA256 signing with configurable secrets
- 3-retry exponential backoff (1s, 5s, 15s)
- 10-second timeout per request
- Fire-and-forget (doesn't block the triggering operation)

### 6.5 Pick List Service (`pickList.ts`)

- Generates pick list from pending orders
- Batch-fetches variant/product/location data (efficient N+1 avoidance)
- Sorted by location name then product name

### 6.6 Alerts Service (`alerts.ts`)

- Scans all inventory levels for low stock (available < threshold)
- Returns sorted by deficit (worst first)
- Batch-fetches related entities to avoid N+1

---

## 7. Backend Utilities

### 7.1 Pagination (`pagination.ts`)

- `parsePagination(query)`: Extracts page (default 1) and limit (default 25, max 100)
- `buildPaginationResponse(page, limit, total)`: Standard `{ page, limit, total, totalPages }` envelope
- `paginate(page, limit)`: Returns `{ skip, take }` for TypeORM

### 7.2 Sort (`sort.ts`)

- `parseSort(query, allowedColumns)`: Whitelist-based column validation (SQL injection prevention)
- Default: `createdAt DESC`

### 7.3 CSV Export (`csv-export.ts`)

- Generic CSV generator from headers + row objects
- Escapes commas, quotes, newlines
- Filename includes date

### 7.4 PDF (`pdf.ts`)

- Wrapper around pdfkit with helpers: `createPdf`, `drawHeader`, `drawTable`, `drawFooters`, `drawInfoBlock`
- Automatic page breaks with re-drawn table headers
- Alternating row colors, ellipsis for overflow
- Page numbering in footer

### 7.5 Logger (`logger.ts`)

- pino with structured JSON in production, pino-pretty in dev
- Redacts authorization and cookie headers
- Configurable log level via `LOG_LEVEL`

### 7.6 OpenAPI (`openapi.ts`)

- 650-line static OpenAPI 3.1.0 specification
- Mounted at `/docs` (Swagger UI) and `/docs/openapi.json`
- 19 tags covering all API domains
- Global `bearerAuth` security with public overrides for auth/webhook/health

---

## 8. Frontend Architecture

### 8.1 API Client (`api/client.ts`)

- **Token storage**: localStorage (`access_token`, `refresh_token`)
- **Token refresh**: Automatic 401 → refresh → retry (deduplicates concurrent refreshes)
- **`apiFetch<T>(path, options)`**: Typed fetch with auth headers + refresh logic
- **`apiUpload<T>(path, formData)`**: Multipart upload with auth
- **`openAuthenticatedUrl(path)`**: Download PDFs/CSVs with auth headers via blob URL
- **`logout()`**: Clears tokens, redirects to login
- **QueryClient**: 10s stale time, 1 retry, refetch on focus/mount/reconnect

### 8.2 Auth Hook (`useAuth.ts`)

- **`useAuth()`**: React Query hook fetching `/auth/me` (5min stale time)
- **`useLogin()`**: Mutation that stores tokens + sets query cache
- **`useLogout()`**: Mutation that calls logout API + clears cache
- **Custom `authFetch`**: Bypasses `apiFetch` (no base path, no refresh, no 401 retry — BUGS.md #33)

### 8.3 URL Filter State (`useUrlFilters.ts`)

- All filter/sort/page state persisted in URL search params
- Auto-resets to page 1 on filter changes
- Toggle sort direction on repeated column click
- Shared across all list pages

### 8.4 Page Components (16 pages)

| Page | Route | Key Features |
|------|-------|--------------|
| LoginPage | `/login` | Email/password form, JWT storage |
| ProductsPage | `/` (root) | CRUD table, search/filter/sort, image gallery, variant management, CSV export |
| OrdersPage | `/orders` | Status badges, state-machine transitions, tracking, packing slip PDF, CSV export |
| InventoryPage | `/inventory` | Stock levels table, adjust dialog, low-stock highlighting, CSV export |
| LocationsPage | `/locations` | CRUD table with variant counts |
| TransfersPage | `/transfers` | Transfer form, status workflow |
| StocktakesPage | `/stocktakes` | Stocktake creation, count entry, discrepancy display |
| ReturnsPage | `/returns` | Return lifecycle, condition tracking |
| PurchaseOrdersPage | `/purchase-orders` | PO lifecycle, receiving workflow |
| SuppliersPage | `/suppliers` | CRUD with product counts |
| PickListPage | `/pick-list` | Pick list table + PDF download |
| ReportsPage | `/reports` | KPI cards, 4 charts (recharts), inventory valuation table |
| AuditLogsPage | `/audit-logs` | Filterable log viewer |
| WebhookConfigsPage | `/webhooks` | Webhook CRUD with event toggles |
| SettingsPage | `/settings` | Profile, users, webhooks, API keys tabs |
| NotFoundPage | `*` | 404 fallback |

### 8.5 Reusable Components (16 components)

| Component | Purpose |
|-----------|---------|
| Layout | Sidebar nav + header with notifications, dark mode toggle |
| ErrorBoundary | Catches render errors, shows retry UI |
| LoadingFallback | Full-page spinner for route transitions |
| Pagination | Prev/next + page number buttons |
| FilterBar | Search input + filter dropdowns |
| SortableHeader | Click-to-sort column headers |
| SkeletonTable | Loading placeholder for tables |
| ProductForm | Product create/edit with variant management + image upload |
| ProductTable | Product list table |
| StockAdjustDialog | Modal for stock adjustments |
| TransferForm | Transfer creation form |
| UserForm | User create/edit form |
| PickListTable | Pick list items with barcode scanner integration |
| BarcodeScanner | Camera-based barcode scanning (@zxing/browser) |
| BulkAdjustModal | Bulk inventory adjustment UI |
| ConfirmModal | Confirmation dialog (replaces window.confirm) |

### 8.6 React Query Hooks (20 hooks)

| Hook | API Endpoints | Key Operations |
|------|--------------|----------------|
| useAuth | /auth/* | login, logout, me, token refresh |
| useProducts | /api/products | CRUD, search, variants, images |
| useOrders | /api/orders | list, status, shipping, tracking |
| useInventory | /api/inventory | list, adjust |
| useLocations | /api/locations | CRUD |
| useTransfers | /api/transfers | CRUD, status |
| useStocktakes | /api/stocktakes | CRUD, status, items |
| useReturns | /api/returns | CRUD, lifecycle |
| usePurchaseOrders | /api/purchase-orders | CRUD, send, receive, cancel |
| useSuppliers | /api/suppliers | CRUD |
| useUsers | /api/users | CRUD (admin) |
| usePickList | /api/pick-list | list (10s polling) |
| useReports | /api/reports | summary, charts |
| useNotifications | /api/notifications | list, read, read-all, unread-count |
| useWebhookConfigs | /api/webhooks/config | CRUD |
| useAuditLogs | /api/audit-logs | list with filters |
| useBulkOperations | /api/bulk | bulk-delete, bulk-status, bulk-adjust |
| useDarkMode | localStorage | dark/light theme toggle |
| useKeyboardShortcuts | DOM | `/` search, `n` new, `Esc` close |
| useUrlFilters | URL params | filter/sort/page state |

---

## 9. Infrastructure & Deployment

### 9.1 Docker Compose (4 services)

| Service | Image | Port | Memory | Purpose |
|---------|-------|------|--------|---------|
| db | postgres:17-alpine | internal | 1 GB | PostgreSQL with healthcheck |
| server | ghcr.io/.../server | 3002 | 512 MB | Bun/Hono API server |
| web | ghcr.io/.../web | 80 | 128 MB | nginx serving React SPA |
| watchtower | containrrr/watchtower | — | 64 MB | Auto-update container images every 60s |

### 9.2 nginx Configuration

- Reverse proxy: `/api/`, `/auth/`, `/webhooks/`, `/health` → `http://server:3002`
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, CSP
- Gzip compression for text/css/json/js/xml (min 1024 bytes)
- Static asset caching: `/assets/` 1 year, `/index.html` no-cache
- `client_max_body_size 10m`
- SPA fallback: `try_files $uri $uri/ /index.html`

### 9.3 CI/CD (GitHub Actions)

**ci.yml** (PRs + main):
- Server checks: typecheck + integration tests with Postgres 17 service container
- Web checks: typecheck + production build

**docker.yml** (main/tags):
- Build + push server and web images to GHCR
- Tags: `latest` + commit SHA

### 9.4 Server Entrypoint

1. `npx tsx src/scripts/setup-db.ts` — DB schema sync
2. `npx tsx src/scripts/seed-admin.ts` — Create admin user (non-fatal if exists)
3. `exec npx tsx src/index.ts` — Start server

### 9.5 Database Backup

- `scripts/backup.sh`: `pg_dump` through Docker, gzip compressed, 30-day retention

---

## 10. Security Model

### 10.1 Authentication

- JWT access tokens (15m expiry) + refresh tokens (7d expiry)
- bcrypt password hashing (12 rounds)
- Token versioning for logout/invalidation
- Rate-limited login (10 attempts / 15 min per IP)

### 10.2 Authorization (RBAC)

| Resource | Admin | Manager | Warehouse |
|----------|-------|---------|-----------|
| users | ✓ | ✗ | ✗ |
| webhooks/config | ✓ | ✗ | ✗ |
| products | ✓ | ✓ | ✗ |
| suppliers | ✓ | ✓ | ✗ |
| purchase-orders | ✓ | ✓ | ✗ |
| returns | ✓ | ✓ | ✗ |
| orders | ✓ | ✓ | ✓ |
| reports | ✓ | ✓ | ✗ |
| audit-logs | ✓ | ✓ | ✗ |
| bulk | ✓ | ✓ | ✗ |
| pick-list | ✓ | ✓ | ✓ |
| inventory | ✓ | ✓ | ✓ |
| transfers | ✓ | ✓ | ✓ |
| stocktakes | ✓ | ✓ | ✓ |
| locations | ✓ | ✓ | ✓ |
| notifications | ✓ | ✓ | ✓ |
| alerts | ✓ | ✓ | ✓ |

### 10.3 Webhook Security

- HMAC-SHA256 signature verification on incoming webhooks (`X-Webhook-Signature`)
- `timingSafeEqual` for constant-time comparison
- SSRF protection on webhook config URLs (blocks RFC 1918, loopback, link-local)

### 10.4 Data Protection

- Password hashes excluded from API responses (`sanitizeUser`)
- Webhook secrets masked in API responses (`••••••••`)
- CORS configurable via `ALLOWED_ORIGINS`
- Optimistic locking on `InventoryLevel` (version column)
- Pessimistic locking (`SELECT ... FOR UPDATE`) on critical inventory operations

---

## 11. Known Issues (from BUGS.md)

93 total issues tracked: **13 fixed**, **80 open**

### Critical (0 open — all 13 fixed)
All critical bugs from the 2026-04-26 audit have been resolved, including: broken OR search, race conditions, double deduction, missing state machine, privilege escalation, SSRF, secret exposure.

### High Priority (20 open)
Key remaining issues include:
- No transaction wrapping on product creation (#14)
- `stockStatus` filter loads ALL products into memory (#15)
- Client-controlled `adjustedBy` field (#16)
- Silent stock underflow with `Math.max(0, ...)` (#17)
- Unsafe status type casts (#18)
- DELETE /users/:id missing role check (#19)
- Bulk status duplicates order bugs (#20)
- Generic PATCH on POs accepts arbitrary status (#21)
- Missing dependency checks on location delete (#22)
- Missing pessimistic locks in transfer completion (#23)
- Missing source inventory silently skipped (#24)
- No pessimistic lock on webhook order allocation (#25)
- Email sent before transaction commit (#26)
- XSS in email templates (#27)
- HTTP header injection in PDF filenames (#28)
- OpenAPI security misconfiguration (#29)
- No AbortController in frontend (#30)
- Tokens in localStorage (#31)
- Stale token redirect failure (#32)
- Custom authFetch bypasses apiFetch (#33)

### Medium (32 open), Low (28 open)
See BUGS.md for complete list.

---

## 12. Code Quality Assessment

### 12.1 Strengths

1. **Consistent architecture**: Clear separation of entities/routes/services/middleware/utils
2. **Zod validation**: All input validated with zod schemas before processing
3. **Transactional safety**: Critical operations use `AppDataSource.transaction()` with pessimistic locks
4. **State machines**: Order, transfer, stocktake, return, and PO lifecycles are enforced
5. **Standardized errors**: `AppError` with structured codes and consistent JSON shape
6. **Comprehensive audit trail**: 17 audit action types covering all mutations
7. **Pagination/sort/search**: Consistent patterns across all list endpoints
8. **RBAC**: Fine-grained role-based access with DB-verified permissions
9. **PDF generation**: Reusable pdfkit utilities for packing slips and pick lists
10. **CSV export**: Available on products, orders, and inventory
11. **Lazy loading**: All frontend routes loaded on demand
12. **URL-persisted filters**: Filter/sort/page state survives navigation
13. **Structured logging**: pino with redaction and environment-aware formatting
14. **OpenAPI docs**: Complete interactive API documentation at `/docs`
15. **Docker production-ready**: nginx security headers, memory limits, auto-updates via watchtower

### 12.2 Weaknesses

1. **Type safety gaps**: Pervasive `any` types in catch blocks, `as any` casts, `PDFDoc` typed as `any`
2. **Duplicate types**: Frontend re-defines `InventoryLevel`, `Location`, etc. in multiple hooks instead of sharing
3. **No shared types package**: Server and web don't share TypeScript interfaces
4. **In-memory rate limiting**: Won't work across multiple server instances
5. **`synchronize: true` in dev**: No enforced migration workflow during development
6. **Inconsistent error handling**: Some routes use `AppError`, some return raw `{ error: string }` (notifications, webhookConfigs)
7. **stockStatus filter**: Loads all products into JS memory for filtering instead of using SQL
8. **Missing AbortController**: Frontend requests never cancelled on unmount
9. **localStorage tokens**: Vulnerable to XSS extraction
10. **Custom authFetch**: useAuth.ts bypasses the main apiFetch (no refresh, no base path)
11. **Email before commit**: Order confirmation emails sent before transaction completes
12. **No SKU uniqueness check**: Duplicate SKUs allowed at variant level
13. **CSV injection**: No sanitization of formula prefixes (`=`, `+`, `@`)
14. **Double DB lookup in RBAC**: `requireRole` + `requirePermission` each query user independently
15. **No debounce on audit log search**: Fires per keystroke

### 12.3 Code Metrics (Approximate)

| Area | Files | Approx Lines |
|------|-------|-------------|
| Entities | 20 | ~630 |
| Routes | 19 | ~3,400 |
| Middleware | 5 | ~175 |
| Services | 6 | ~525 |
| Utils | 7 | ~975 (incl. openapi.ts at 650) |
| Server entry/config | 3 | ~90 |
| Frontend hooks | 20 | ~1,100 |
| Frontend components | 16 | ~2,200 |
| Frontend pages | 16 | ~4,500 |
| Frontend API/client | 1 | ~183 |
| **Total source** | **~113** | **~13,800** |

---

## 13. Roadmap Progress

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation & Security | ~80% (migrations, some hardening pending) |
| 2 | Core UX & Data | ~70% (pagination/search/sort done, variant management, UI polish pending) |
| 3 | Warehouse Operations | ~75% (transfers, stocktakes, barcodes done; PDF partially done) |
| 4 | Business Intelligence | ~90% (reports, webhooks, notifications done; auto-notifications pending) |
| 5 | Users, Roles & Settings | ~90% (RBAC, user management, settings done; forgot-password pending) |
| 6 | Integrations & Ecosystem | ~90% (suppliers, POs, shipping, returns, email, images done; S3, ShipStation pending) |
| 7 | Polish & Scale | ~60% (CI/CD, logging, indexes, lazy routes, dark mode, API docs done; Redis, PWA, i18n pending) |

---

## 14. Testing Coverage

- **Backend tests**: `server/tests/*.test.ts` — integration tests (typecheck + test in CI)
- **E2E test**: `scripts/e2e-test.sh` — full order lifecycle via HTTP API (11 steps)
- **CI pipeline**: TypeScript type checking + integration tests on every PR
- **No unit tests**: Business logic in services is not unit-tested in isolation
- **No frontend tests**: No component or hook tests

---

## 15. Recommendations

### High Priority
1. Add transaction wrapping to product creation (`server/src/routes/products.ts:267-311`)
2. Move stockStatus filtering to SQL to prevent OOM on large datasets
3. Derive `adjustedBy` from JWT session instead of accepting client input
4. Add role check to `DELETE /users/:id`
5. Replace generic PATCH on POs with specific state transition endpoints
6. Add dependency check before location deletion
7. Fix `authFetch` in `useAuth.ts` to use `apiFetch` or at minimum add token refresh
8. Add AbortController to frontend API calls

### Medium Priority
9. Extract shared TypeScript types between server and web
10. Replace `any` types with proper interfaces
11. Add SKU uniqueness validation on product/variant creation
12. Sanitize CSV exports against formula injection
13. Move email sending after transaction commit
14. Add debounce to audit log search
15. Consolidate RBAC middleware to single DB lookup
16. Fix inconsistent error shapes in notifications and webhookConfigs

### Low Priority
17. Add Redis caching for frequently accessed data
18. Implement virtual scrolling for large tables
19. Add `CONTRIBUTING.md`
20. Consider monorepo tooling (turborepo/nx) for shared types
21. Add frontend tests (vitest + testing-library)
22. Add unit tests for service layer
23. Replace localStorage with httpOnly cookies for token storage
