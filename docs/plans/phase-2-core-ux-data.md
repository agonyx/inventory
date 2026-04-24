# Phase 2 — Core UX & Data Implementation Plan

> **For Hermes:** Use opencode-orchestration skill to implement in parallel batches.

**Goal:** Make day-to-day warehouse operations smooth — pagination, search, filtering, sorting, locations page, variant management, export, and UI polish.

**Architecture:** Backend-first approach. Create reusable pagination/sort helpers, apply them to all list endpoints, then build shared frontend components (pagination, filter bar, sort headers, toast, modals), then update all pages to use them.

**Tech Stack:** Hono + TypeORM (server), React + Vite + TailwindCSS + React Query + React Router (web), sonner for toasts.

---

## Batch 1 — Backend Foundation

### Task 1.1: Create reusable pagination helper

**Files:**
- Create: `server/src/utils/pagination.ts`

```typescript
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(query: Record<string, any>): PaginationOptions {
  let page = parseInt(query.page, 10) || 1;
  let limit = parseInt(query.limit, 10) || 25;
  limit = Math.min(Math.max(limit, 1), 100);
  page = Math.max(page, 1);
  return { page, limit };
}

export function buildPaginationResponse(page: number, limit: number, total: number): PaginationResult {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}
```

### Task 1.2: Create reusable sort helper

**Files:**
- Create: `server/src/utils/sort.ts`

```typescript
export interface SortOptions {
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
}

const DEFAULT_SORT: SortOptions = { sortBy: 'createdAt', sortDir: 'DESC' };

export function parseSort(query: Record<string, any>, allowedColumns: string[]): SortOptions {
  let sortBy = query.sortBy || DEFAULT_SORT.sortBy;
  let sortDir = (query.sortDir || 'desc').toUpperCase() as 'ASC' | 'DESC';
  if (sortDir !== 'ASC' && sortDir !== 'DESC') sortDir = 'DESC';
  if (!allowedColumns.includes(sortBy)) sortBy = allowedColumns[0] || DEFAULT_SORT.sortBy;
  return { sortBy, sortDir };
}
```

### Task 1.3: Refactor audit-logs route to use pagination helper (it already has pagination, just refactor)

**Files:**
- Modify: `server/src/routes/auditLogs.ts`

Replace inline pagination with imports from utils. Keep existing behavior.

### Task 1.4: Add pagination + search + filter + sort to GET /api/products

**Files:**
- Modify: `server/src/routes/products.ts`

Query params: `page`, `limit`, `search` (ILIKE on name and sku), `category`, `stockStatus` (in_stock/low_stock/out_of_stock), `sortBy`, `sortDir`.

Allowed sort columns: `name`, `sku`, `category`, `price`, `createdAt`.

Response format: `{ data: [...], pagination: { page, limit, total, totalPages } }`

For `stockStatus` filter: use subquery on inventory levels to compute total stock per product, then compare against `lowStockThreshold`.

### Task 1.5: Add pagination + search + filter + sort to GET /api/orders

**Files:**
- Modify: `server/src/routes/orders.ts`

Query params: `page`, `limit`, `search` (ILIKE on externalOrderId, customerName, customerEmail), `status`, `source`, `from`, `to` (date range on createdAt), `sortBy`, `sortDir`.

Allowed sort columns: `createdAt`, `totalAmount`, `customerName`.

Response format: same paginated structure.

### Task 1.6: Add pagination + filter + sort to GET /api/inventory

**Files:**
- Modify: `server/src/routes/inventory.ts`

Query params: `page`, `limit`, `locationId`, `productId`, `lowStock` (boolean), `sortBy`, `sortDir`.

Allowed sort columns: `quantity`, `reservedQuantity`, `createdAt`.

Response format: same paginated structure.

### Task 1.7: Add pagination to GET /api/locations

**Files:**
- Modify: `server/src/routes/locations.ts`

Add `GET /api/locations/:id` endpoint. Add pagination with `page`, `limit`, `sortBy` (name), `sortDir`.

Add variant count per location using a subquery or RelationCount.

### Task 1.8: Add variant CRUD endpoints

**Files:**
- Modify: `server/src/routes/products.ts`

- `POST /api/products/:id/variants` — add variant to existing product
- `PATCH /api/products/:productId/variants/:variantId` — edit variant (name, sku, description)
- `DELETE /api/products/:productId/variants/:variantId` — remove variant (cascade delete inventory levels). Check if any inventory level has non-zero quantity and include warning in response.

### Task 1.9: Add CSV export endpoints

**Files:**
- Create: `server/src/utils/csv-export.ts`
- Modify: `server/src/routes/products.ts` — add `GET /api/products/export?format=csv&search=...&category=...&sortBy=...&sortDir=...`
- Modify: `server/src/routes/orders.ts` — add `GET /api/orders/export?format=csv&status=...&search=...&from=...&to=...&sortBy=...&sortDir=...`
- Modify: `server/src/routes/inventory.ts` — add `GET /api/inventory/export?format=csv&locationId=...&productId=...&lowStock=...&sortBy=...&sortDir=...`

CSV export helper: `exportToCsv(headers: string[], rows: any[]): string` — returns CSV string. Set `Content-Type: text/csv` and `Content-Disposition: attachment; filename=...`.

Export uses the same filters/search/sort as list endpoint but without pagination (return all matching rows).

### Task 1.10: Update backend tests

**Files:**
- Modify existing test files to account for new paginated response format

Run: `cd ~/projects/niche-inventory/server && bun test`

---

## Batch 2 — Frontend Infrastructure Components

### Task 2.1: Install sonner for toast notifications

**Run:** `cd ~/projects/niche-inventory/web && bun add sonner`

### Task 2.2: Create Pagination component

**Files:**
- Create: `web/src/components/Pagination.tsx`

Props: `page`, `totalPages`, `total`, `limit`, `onPageChange`, `onLimitChange`.

Shows: prev/next buttons, page numbers (with ellipsis for large page counts), page size selector (25/50/100), "Showing X to Y of Z" text.

### Task 2.3: Create FilterBar component

**Files:**
- Create: `web/src/components/FilterBar.tsx`

Generic component with debounced search input (300ms), configurable dropdown filters, date pickers for range. Reads/writes filter state from/to URL search params via `useSearchParams`.

### Task 2.4: Create SortableHeader component

**Files:**
- Create: `web/src/components/SortableHeader.tsx`

Props: `label`, `column`, `currentSort`, `onSortChange`. Renders a `<th>` with clickable header, shows ↑↓ indicator based on current sort.

### Task 2.5: Create ConfirmModal component

**Files:**
- Create: `web/src/components/ConfirmModal.tsx`

Props: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `variant` (danger/primary), `onConfirm`, `onCancel`. Replaces all `window.confirm()` usage.

### Task 2.6: Create loading skeleton components

**Files:**
- Create: `web/src/components/SkeletonTable.tsx` — skeleton rows for tables
- Create: `web/src/components/SkeletonCard.tsx` — skeleton for card layouts

### Task 2.7: Create ErrorBoundary component

**Files:**
- Create: `web/src/components/ErrorBoundary.tsx`

Class component with error state, shows "Something went wrong" message + retry button. Log error to console.

### Task 2.8: Create 404 page

**Files:**
- Create: `web/src/pages/NotFoundPage.tsx`

Simple "Page not found" page with link back to home.

### Task 2.9: Add Toaster to App.tsx and ErrorBoundary + 404 route

**Files:**
- Modify: `web/src/App.tsx` — add `<Toaster />` from sonner, wrap routes in `<ErrorBoundary>`, add 404 catch-all route.

### Task 2.10: Create useUrlFilters hook

**Files:**
- Create: `web/src/hooks/useUrlFilters.ts`

Custom hook that manages filter/sort/pagination state in URL search params. Returns `{ filters, setFilter, removeFilter, sort, setSort, page, setPage, limit, setLimit, resetFilters }`.

---

## Batch 3 — Frontend Page Updates

### Task 3.1: Update ProductsPage with pagination, search, filtering, sorting, export

**Files:**
- Modify: `web/src/pages/ProductsPage.tsx`
- Modify: `web/src/components/ProductTable.tsx`
- Modify: `web/src/hooks/useProducts.ts` — update to accept pagination/filter/sort params, return paginated response

Features:
- Search by name/SKU
- Filter by category, stock status
- Sortable columns (name, SKU, category, price, created)
- Pagination component
- "Export CSV" button
- Delete confirmation modal
- Success toast on create/update/delete
- Loading skeletons

### Task 3.2: Update OrdersPage with pagination, search, filtering, sorting, export

**Files:**
- Modify: `web/src/pages/OrdersPage.tsx`
- Modify: `web/src/components/OrderList.tsx`
- Modify: `web/src/hooks/useOrders.ts` — update to accept pagination/filter/sort params

Features:
- Search by order ID, customer name/email
- Filter by status, source, date range
- Sortable columns
- Pagination
- Export CSV
- Loading skeletons

### Task 3.3: Create LocationsPage

**Files:**
- Create: `web/src/pages/LocationsPage.tsx`
- Modify: `web/src/hooks/useLocations.ts` — add useUpdateLocation, useDeleteLocation hooks, paginated response
- Modify: `web/src/App.tsx` — add route
- Modify: `web/src/components/Layout.tsx` — add nav link with MapPin icon

Features:
- CRUD table for locations
- Variant count per location
- Edit/delete actions
- Create form (modal or inline)
- Confirmation modal for delete
- Success toasts

### Task 3.4: Create InventoryPage (new page)

**Files:**
- Create: `web/src/pages/InventoryPage.tsx`
- Modify: `web/src/hooks/useInventory.ts` — add useInventory query with pagination/filter params
- Modify: `web/src/App.tsx` — add route
- Modify: `web/src/components/Layout.tsx` — add nav link with Warehouse icon

Features:
- Table showing variant → product → location → quantity → reserved
- Filter by location, product, low stock
- Sort by quantity, reserved
- Pagination
- Export CSV
- Adjust stock dialog (existing StockAdjustDialog)

### Task 3.5: Add variant management to ProductForm

**Files:**
- Modify: `web/src/components/ProductForm.tsx` — add variant editor section with add/remove rows

Features:
- Dynamic add/remove variant rows
- Name + SKU fields per variant
- Warning when removing variant with non-zero inventory
- Works on both create and edit

### Task 3.6: Update AuditLogsPage

**Files:**
- Modify: `web/src/pages/AuditLogsPage.tsx` — already has some features, add filter bar, sort headers, persist state in URL

---

## Batch 4 — Polish & Verify

### Task 4.1: Add keyboard navigation
- Tab through table rows, Enter to expand, Escape to close modals

### Task 4.2: Add per-field form validation
- Red borders and error messages below inputs on ProductForm and LocationForm

### Task 4.3: Verify build and tests
- `cd ~/projects/niche-inventory/web && bun run build` — should succeed
- `cd ~/projects/niche-inventory/server && bun test` — all tests pass
