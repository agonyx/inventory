# Phase 9A — Backend Medium-Priority Fixes

> **For Hermes:** Use OpenCode via tmux to implement this spec.
> **Goal:** Fix all medium-priority backend bugs for consistency and correctness.
> **Files to modify:** server/ source files only. No frontend changes.

---

## Task 1: Sanitize CSV exports against formula injection (#34)

**File:** `server/src/utils/csv-export.ts`

**Fix:** Add a `sanitizeCsvCell` function that prefixes cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote `'`. Apply it to every cell value in `exportToCsv`.

---

## Task 2: Escape LIKE wildcards in search queries (#35)

**Files:**
- `server/src/routes/transfers.ts` (~line 58)
- `server/src/routes/returns.ts` (~line 47)

**Fix:** Add an `escapeLike(str)` utility that escapes `%`, `_`, `\` with `\`. Apply to all user-provided search strings before they're used in `ILike()` patterns. Also apply in `server/src/routes/products.ts` and `server/src/routes/orders.ts` search patterns if they don't already escape.

---

## Task 3: Remove search on UUID fields in transfers (#36)

**File:** `server/src/routes/transfers.ts` (~line 60-62)

**Fix:** The search query applies `ILike` to `fromLocationId` and `toLocationId` which are UUIDs — useless. Remove those fields from the search OR conditions. Only search on `notes` (which is the only text field worth searching on transfers).

---

## Task 4: Consolidate RBAC double DB lookup (#37)

**File:** `server/src/middleware/rbac.ts`

**Fix:** `requireRole` and `requirePermission` each query the user from DB independently. When both are used on the same route (common), that's 2 DB queries. Merge them: if `requireRole` already fetched the user, attach it to context so `requirePermission` can reuse it. Add `c.set('dbUser', user)` in requireRole, and in requirePermission check `c.get('dbUser')` first before querying.

---

## Task 5: Fix inconsistent error shapes in notifications (#38) and webhookConfigs (#39)

**Files:**
- `server/src/routes/notifications.ts`
- `server/src/routes/webhookConfigs.ts`

**Fix:** These routes return raw `{ error: "message" }` instead of using `AppError`. Replace all `c.json({ error: "..." }, status)` with `throw new AppError(status, ErrorCode.XXX, "...")`. Make sure `errorHandler` is imported and registered.

---

## Task 6: Add SKU uniqueness check on product/variant creation (#40)

**File:** `server/src/routes/products.ts`

**Fix:** In `POST /` (create product) and `POST /:id/variants` (add variant), check if the SKU already exists before saving. Query by `sku` on Product (for product SKU) and on ProductVariant (for variant SKU). If found, throw `AppError(409, ErrorCode.CONFLICT, 'SKU already exists')`.

---

## Task 7: Validate file extension server-side (#41)

**File:** `server/src/routes/products.ts` (image upload handler, ~line 465)

**Fix:** Derive the file extension from the original filename (not the client MIME type). Add an `ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']` constant. After saving, validate the extension matches. If not, delete the file and throw AppError.

---

## Task 8: Fix pagination total when lowStock filter applied (#42)

**File:** `server/src/routes/inventory.ts`

**Fix:** The `lowStock` filter is applied in-memory after the DB query, but `total` comes from the unfiltered count. Move the `lowStock` filtering into the SQL query using a WHERE clause on the joined variant's `lowStockThreshold` vs inventory level's `quantity`.

---

## Task 9: Fix stocktake item update — wrap in transaction (#44)

**File:** `server/src/routes/stocktakes.ts` (~line 200-223)

**Fix:** The item update handler checks `stocktake.status === 'in_progress'` then saves. Wrap in `AppDataSource.transaction()` with pessimistic lock on the stocktake row to prevent race conditions.

---

## Task 10: Fix transfer stock deduction — reject underflow (#45)

**File:** `server/src/routes/transfers.ts` (~line 167)

**Fix:** In transfer completion, if `sourceLevel.quantity < item.quantity`, throw AppError instead of clamping. Same pattern as the fix we applied in Phase 8 to orders.

---

## Task 11: Fix inventory-valuation using INNER JOIN (#46)

**File:** `server/src/routes/reports.ts` (~line 138-161)

**Fix:** Change `innerJoin` to `leftJoin` on ProductVariant so products without variants are included (with 0 stock value).

---

## Task 12: Fix reports/orders-by-status query (#64)

**File:** `server/src/routes/reports.ts` (~line 24)

**Fix:** Replace `DATE("createdAt") = CURRENT_DATE` with an indexable range: `createdAt >= CURRENT_DATE AND createdAt < CURRENT_DATE + INTERVAL '1 day'`.

---

## Task 13: Fix redundant save in orderProcessor (#63)

**File:** `server/src/services/orderProcessor.ts`

**Fix:** Remove `order.items = orderItems;` followed by no explicit save of the order with items — the orderItems are already individually saved. The line `order.items = orderItems` just sets the in-memory relation but doesn't need to be saved separately since each item was already saved. Remove the redundant assignment or the redundant save if there is one. Actually, looking at the code, `order.items = orderItems` is needed so the returned order includes items. Just remove it from before the transaction and set it after the transaction resolves.

---

## Task 14: Add missing errorHandler import in route files (#89)

**Files:** `server/src/routes/alerts.ts`, `notifications.ts`, `auditLogs.ts`, `pickList.ts`, `webhookConfigs.ts`

**Fix:** For any file that's missing `app.onError(errorHandler)`, add it. Check each file — if `errorHandler` is already imported and used, skip it.

---

## Task 15: Remove unused repository helpers (#91)

**Files:** `server/src/routes/transfers.ts` (~line 16-18), `stocktakes.ts` (~line 16-19), `returns.ts` (~line 16-18)

**Fix:** Check if the module-level repository helper functions (e.g., `const transferRepo = () => ...`) at the top of these files are actually used. If they're never called (because the code uses `manager.getRepository()` inside transactions instead), remove them.

---

## Task 16: Fix string entity reference in returns route (#92)

**File:** `server/src/routes/returns.ts` (~line 73)

**Fix:** Replace the string reference `'Order'` with the actual `Order` entity class import.

---

## Task 17: Fix audit action string casts in purchaseOrders (#93)

**File:** `server/src/routes/purchaseOrders.ts` (lines 142, 169, 191, 262, 290)

**Fix:** Replace all `'some_action' as AuditAction` string casts with proper `AuditAction.SOME_ACTION` enum values.

---

## Verification

After all tasks complete, run: `cd server && bunx tsc --noEmit`

Print DONE_WORKING_PHASE9A when finished.
