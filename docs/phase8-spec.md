# Phase 8 — Critical & High-Priority Bug Fixes

> **For Hermes:** Use OpenCode via tmux to implement this spec task-by-task.
> **Goal:** Fix all 20 high-priority bugs for data integrity and security.
> **Files to modify:** 8 backend files only. No frontend changes in this phase.

---

## Task 1: Wrap product creation in transaction (#14)

**File:** `server/src/routes/products.ts` lines 267-312

**What to do:** The `app.post('/')` handler creates product, then variants, then inventory levels in separate non-transactional calls. If any step fails, orphaned rows remain.

**Fix:** Wrap the entire handler body (after `c.req.valid('json')`) in `AppDataSource.transaction(async (manager) => { ... })`. Use `manager.getRepository()` instead of the helper functions (`productRepo()`, `variantRepo()`, `inventoryRepo()`, `locationRepo()`). The return value should be the fully loaded product with relations.

---

## Task 2: Move stockStatus filtering to SQL (#15)

**File:** `server/src/routes/products.ts` lines 102-139

**What to do:** Currently loads ALL products into memory when `stockStatus` filter is used, then filters in JS. This causes OOM on large datasets.

**Fix:** Replace the in-memory filter with a SQL subquery approach. Use TypeORM's `QueryBuilder` to:
1. Build a subquery that sums `(quantity - reservedQuantity)` per product (via variants → inventory_levels)
2. Apply `HAVING` conditions based on `stockStatus`:
   - `in_stock`: total > product.lowStockThreshold (or 0 if null)
   - `low_stock`: total > 0 AND total <= threshold
   - `out_of_stock`: total = 0 OR no inventory rows
3. Use `findAndCount` with this query builder for proper pagination
4. Remove the `allResults.filter()` in-memory block entirely

The computeTotalStock helper can stay for non-stockStatus use cases.

---

## Task 3: Derive adjustedBy from JWT session (#16)

**Files:**
- `server/src/routes/inventory.ts` lines 18-22, 130-148

**What to do:** `adjustedBy` is accepted from client JSON body, allowing audit trail impersonation.

**Fix:**
1. Remove `adjustedBy` from the `adjustSchema` zod object (line 22 area)
2. In the adjust handler, get `adjustedBy` from `c.get('auth')?.userId` (the JWT session)
3. Use this value in the `StockAdjustment` create and the `AuditLog` create
4. The frontend `StockAdjustDialog` already sends `adjustedBy` — that field will simply be ignored by the backend now

---

## Task 4: Add role check to DELETE /users/:id (#19)

**File:** `server/src/routes/users.ts` lines 98-111

**What to do:** Any authenticated user can delete any other user. The route needs `requireRole('admin')`.

**Fix:** Check that `c.get('auth')?.role === 'admin'` at the start of the handler. If not admin, throw `new AppError(403, ErrorCode.FORBIDDEN, 'Only admins can delete users')`.

---

## Task 5: Validate order status with zod enum (#18) + Reject silent stock underflow (#17)

**File:** `server/src/routes/orders.ts` lines 171-213

**What to do:**
1. The `statusSchema` accepts any string. Add `.nativeEnum(OrderStatus)` validation.
2. Lines 203-210: stock deductions (`level.reservedQuantity -= item.quantity`, `level.quantity -= item.quantity`) can go negative silently. Add checks before deduction:
   - For reservation release: `if (level.reservedQuantity < item.quantity)` throw INSUFFICIENT_STOCK
   - For quantity deduction: `if (level.quantity < item.quantity)` throw INSUFFICIENT_STOCK

---

## Task 6: Fix bulk status update inventory bugs (#20)

**File:** `server/src/routes/bulk.ts` lines 128-159

**What to do:** Same pattern as single order status — stock mutations can go negative.

**Fix:** Add the same underflow checks as Task 5 to each inventory mutation in the bulk loop (lines 149-157). Also validate the status input with `OrderStatus` enum in `bulkStatusSchema`.

---

## Task 7: Replace generic PATCH on purchase orders (#21)

**File:** `server/src/routes/purchaseOrders.ts` lines 160-178

**What to do:** `PATCH /:id` allows setting arbitrary status, bypassing the specific `send`, `receive`, `cancel` endpoints which have proper state validation.

**Fix:** Remove `data.status` from the generic PATCH handler. Only allow updating `notes` via PATCH. The existing specific endpoints (`/send`, `/receive`, `/cancel`) handle all status transitions. Update the `updatePOSchema` to only accept `notes?: string`.

---

## Task 8: Add dependency check before location deletion (#22)

**File:** `server/src/routes/locations.ts` lines 88-94

**What to do:** Deleting a location can cause FK errors or orphaned inventory levels.

**Fix:** Before deleting, check if any `InventoryLevel`, `Transfer`, or `Stocktake` references this location. If so, throw `new AppError(409, ErrorCode.CONFLICT, 'Cannot delete location with associated inventory, transfers, or stocktakes')`.

Query: `SELECT COUNT(*) FROM inventory_levels WHERE "locationId" = :id` + same for transfers (fromLocationId or toLocationId) and stocktakes.

---

## Task 9: Add pessimistic lock to webhook order reservation (#25)

**File:** `server/src/services/orderProcessor.ts` lines 50-76

**What to do:** Inventory levels are read and updated without pessimistic locks during webhook order processing, allowing concurrent over-allocation.

**Fix:** Add `lock: { mode: 'pessimistic_write' }` to the `manager.find(InventoryLevel, ...)` call at line 50. Also add a re-check of available stock after acquiring the lock (between lines 64-66) in case another transaction reduced it.

---

## Task 10: Move email sending after transaction commit (#26)

**File:** `server/src/services/orderProcessor.ts` lines 107-109

**What to do:** `sendOrderConfirmation(order)` is called inside the transaction, so the email may be sent for an order that gets rolled back.

**Fix:** Move the `sendOrderConfirmation(result)` call AFTER the `return await AppDataSource.transaction(...)` completes. The function should capture the returned order, then send the email outside the transaction. Same pattern as `sendShippingConfirmation` in orders.ts (line 232-235).

---

## Task 11: Fix XSS in email templates (#27)

**File:** `server/src/services/email.ts` lines 74-195

**What to do:** Order data (customerName, externalOrderId, item names, SKUs) is interpolated directly into HTML without escaping.

**Fix:** Add an `escapeHtml` utility function at the top of the file:
```typescript
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```
Apply it to all user-derived values interpolated into HTML:
- `sendOrderConfirmation`: order.externalOrderId, order.customerName, item variant names, SKUs, customerEmail
- `sendShippingConfirmation`: same fields + trackingNumber, shippingCarrier
- `sendLowStockAlert`: product name, SKU, location name

---

## Task 12: Sanitize PDF filenames (#28)

**File:** `server/src/utils/pdf.ts` line 52

**What to do:** `pdfResponseHeaders` uses the filename directly in Content-Disposition, allowing HTTP header injection.

**Fix:** Add a `sanitizeFilename` function that strips/replaces dangerous characters:
```typescript
function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]/g, '_').replace(/_{2,}/g, '_');
}
```
Apply it in `pdfResponseHeaders`: `filename="${sanitizeFilename(filename)}"`.

---

## Task 13: Fix OpenAPI security config (#29)

**File:** `server/src/utils/openapi.ts` lines 76-98 (approximate)

**What to do:** `/auth/me` and `/auth/profile` are marked as `security: []` (no auth required), but they DO require a Bearer token.

**Fix:** Change the security array for those two paths from `[]` to `[{ bearerAuth: [] }]` to match their actual auth requirements.

---

## Verification

After all tasks are complete, run:
```bash
cd server && npx tsc --noEmit
```
If typecheck passes, the phase is done.

Print DONE_WORKING_PHASE8 when finished.
