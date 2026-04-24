# Task: Database Indexes Migration

## What to do
Create a TypeORM migration that adds indexes on frequently queried columns. Also add SELECT column projections to key list endpoints for performance.

## Files to create/modify

### 1. Read existing migrations first
Check `server/src/migrations/` directory. Read any existing migration files to understand the migration pattern used in this project. Follow the same pattern exactly.

### 2. Create the index migration
Create a new migration file in `server/src/migrations/` named something like `AddPerformanceIndexes1677721600000.ts` (or whatever timestamp pattern the project uses).

The migration should add these indexes:
- `orders.status` (filtering orders by status)
- `orders."createdAt"` (sorting orders by date)
- `inventory_levels."productId"` (lookups by product)
- `inventory_levels."locationId"` (filtering by location)
- `inventory_levels."variantId"` (lookups by variant)
- `products."sku"` (SKU search)
- `audit_logs."createdAt"` (sorting by date)
- `transfers.status` (filtering by status)
- `stocktakes.status` (filtering by status)
- `notifications."userId"` (filtering by user)
- `notifications.read` (filtering unread)
- `returns.status` (filtering by status)

Use `queryRunner.createIndex()` with `IF NOT EXISTS` to make the migration safe to re-run.

### 3. Add SELECT projections to list endpoints
Read these route files and add `.select()` to list (GET) queries where it makes sense to exclude unnecessary columns:

**Products list** (`server/src/routes/products.ts`):
- In the GET / handler (list all products), if there's a find() or findAndCount() query, add .select() to exclude large text fields if they exist (like long descriptions). Keep: id, name, sku, status, createdAt, updatedAt. Only do this if there are text/blob columns worth excluding.

**Inventory list** (`server/src/routes/inventory.ts`):
- Add .select() to the list query if it fetches unnecessary columns.

**Orders list** (`server/src/routes/orders.ts`):
- Add .select() to the list query. Orders have relations (items) — make sure the projection doesn't break relations. If unsure, skip this one.

**IMPORTANT**: Only add projections if they're safe (don't break relations or response shapes). If a list endpoint uses joins and selecting specific columns would break the join, SKIP it. The indexes alone are a big win.

## Constraints
- Do NOT modify any test files
- Do NOT break any existing API response shapes
- The migration MUST use IF NOT EXISTS to be idempotent
- Follow the existing migration file pattern exactly

## Verification
- `cd server && bun test tests/*.test.ts` — all tests pass
- `cd server && npx tsc --noEmit` — compiles cleanly

Print DONE_WORKING when finished.
