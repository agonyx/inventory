# Bug Audit — 2026-04-26

## CRITICAL

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | **Broken OR search in products** — `name` AND `sku` both must match instead of either | `server/src/routes/products.ts:69-151` | ✅ Fixed |
| 2 | **Race condition on stock adjust** — read-modify-write with no lock, lost updates under concurrency | `server/src/routes/inventory.ts:104-143` | ✅ Fixed |
| 3 | **Double deduction of `reservedQuantity`** on PACKED→SHIPPED path — reserved goes negative | `server/src/routes/orders.ts:163-230` | ✅ Fixed |
| 4 | **No order state machine** — any status can transition to any other, reverting causes repeated stock mutations | `server/src/routes/orders.ts:50-56` | ✅ Fixed |
| 5 | **Bulk delete ignores active stock** — forcefully removes inventory levels regardless of quantity | `server/src/routes/bulk.ts:67-78` | ✅ Fixed |
| 6 | **Privilege escalation on PATCH /users/:id** — any user can promote any other user to admin | `server/src/routes/users.ts:82-84` | ✅ Fixed |
| 7 | **Stock availability check outside transaction in transfers** — concurrent requests allow overselling | `server/src/routes/transfers.ts:84-100` | ✅ Fixed |
| 8 | **Arbitrary location for PO received stock** — picks first DB row, no way to specify destination | `server/src/routes/purchaseOrders.ts:36-43` | ✅ Fixed |
| 9 | **Arbitrary location for return received stock** — picks first inventory level, no destination control | `server/src/routes/returns.ts:205-235` | ✅ Fixed |
| 10 | **SSRF in webhook configs** — no validation on URLs, internal IPs like `169.254.169.254` accepted | `server/src/routes/webhookConfigs.ts:18-55` | ✅ Fixed |
| 11 | **Webhook secrets exposed in API responses** — returned verbatim in GET, POST, PATCH | `server/src/routes/webhookConfigs.ts:14-16` | ✅ Fixed |
| 12 | **Multi-location allocation computed but never applied** — reverts to single-location, spurious stock errors | `server/src/services/orderProcessor.ts:58-92` | ✅ Fixed |
| 13 | **LineChart missing `<Line>` components** — "Orders Over Time" chart renders blank | `web/src/pages/ReportsPage.tsx:122-123` | ✅ Fixed |

## HIGH

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 14 | **No transaction wrapping product creation** — partial failures leave orphaned rows | `server/src/routes/products.ts:262-298` | ❌ Open |
| 15 | **`stockStatus` filter loads ALL products into memory** — OOM risk on large datasets | `server/src/routes/products.ts:106-134` | ❌ Open |
| 16 | **`adjustedBy` is client-controlled** — enables audit trail impersonation | `server/src/routes/inventory.ts:22,134` | ❌ Open |
| 17 | **Silent stock underflow** — `Math.max(0, ...)` clamps negative to 0 instead of rejecting | `server/src/routes/orders.ts:195-196` | ❌ Open |
| 18 | **Unsafe `status as OrderStatus` cast** — no validation, invalid status passed to DB | `server/src/routes/orders.ts:61` | ❌ Open |
| 19 | **DELETE /users/:id has no role check** — any authenticated user can delete any other | `server/src/routes/users.ts:94-107` | ❌ Open |
| 20 | **Bulk status update copies same double-deduction & state machine bugs** as orders.ts | `server/src/routes/bulk.ts:120-141` | ❌ Open |
| 21 | **Generic PATCH on purchase orders accepts arbitrary status** — bypasses business rules | `server/src/routes/purchaseOrders.ts:159-177` | ❌ Open |
| 22 | **Delete location without dependency check** — causes FK errors or orphaned data | `server/src/routes/locations.ts:89-94` | ❌ Open |
| 23 | **Destination inventory in transfer completion read without pessimistic lock** | `server/src/routes/transfers.ts:172-174` | ❌ Open |
| 24 | **Missing source inventory level silently skipped** — creates stock from nothing | `server/src/routes/transfers.ts:166-169` | ❌ Open |
| 25 | **No pessimistic lock on inventory reservation** — concurrent webhooks over-allocate stock | `server/src/services/orderProcessor.ts:25-82` | ❌ Open |
| 26 | **Email sent before transaction commits** — may send confirmation for rolled-back order | `server/src/services/orderProcessor.ts:108-110` | ❌ Open |
| 27 | **XSS in email templates** — external webhook data interpolated into HTML unescaped | `server/src/services/email.ts:75-164` | ❌ Open |
| 28 | **HTTP header injection via unsanitized PDF filename** in Content-Disposition | `server/src/utils/pdf.ts:52` | ❌ Open |
| 29 | **OpenAPI docs mark `/auth/me` and `/auth/profile` as `security: []`** — no auth required | `server/src/utils/openapi.ts:76-98` | ❌ Open |
| 30 | **No AbortController in API client** — in-flight requests never cancelled on unmount | `web/src/api/client.ts:61-104` | ❌ Open |
| 31 | **Tokens stored in localStorage** — fully XSS-extractable | `web/src/api/client.ts:17-28` | ❌ Open |
| 32 | **`openAuthenticatedUrl` doesn't redirect on refresh failure** — stale tokens remain | `web/src/api/client.ts:159-166` | ❌ Open |
| 33 | **Custom `authFetch` bypasses `apiFetch`** — no token refresh, no base path, no 401 retry | `web/src/hooks/useAuth.ts:11-26` | ❌ Open |

## MEDIUM

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 34 | **CSV formula injection** — `=`, `+`, `-`, `@` prefixes not neutralized in export | `server/src/utils/csv-export.ts:4` | ❌ Open |
| 35 | **LIKE wildcard injection** — `%`, `_` not escaped in search queries | `server/src/routes/transfers.ts:58`, `server/src/routes/returns.ts:47` | ❌ Open |
| 36 | **Search applied to UUID fields** — fuzzy matching on `fromLocationId`/`toLocationId` serves no purpose | `server/src/routes/transfers.ts:60-62` | ❌ Open |
| 37 | **Double DB lookup in RBAC** — `requireRole` + `requirePermission` each query user independently | `server/src/middleware/rbac.ts:27-28,50-51` | ❌ Open |
| 38 | **Inconsistent error shape in notifications** — `{ error }` instead of `AppError` format | `server/src/routes/notifications.ts:46-48` | ❌ Open |
| 39 | **Inconsistent error shape in webhookConfigs** — same issue | `server/src/routes/webhookConfigs.ts:41-42,58-59` | ❌ Open |
| 40 | **No SKU uniqueness check on product creation** — duplicate SKUs allowed | `server/src/routes/products.ts:34-47` | ❌ Open |
| 41 | **File extension derived from client MIME type** without validation | `server/src/routes/products.ts:465` | ❌ Open |
| 42 | **Pagination total wrong when `lowStock` filter applied** — uses unfiltered count | `server/src/routes/inventory.ts:49-59` | ❌ Open |
| 43 | **Weak password policy** — `z.string().min(6)` only, no complexity requirements | `server/src/routes/users.ts:15` | ❌ Open |
| 44 | **Stocktake item update not in transaction** — status could change between check and save | `server/src/routes/stocktakes.ts:200-223` | ❌ Open |
| 45 | **Transfer stock deduction clamps to zero** — silently allows phantom inventory | `server/src/routes/transfers.ts:167` | ❌ Open |
| 46 | **`inventory-valuation` uses INNER JOIN on variants** — products without variants excluded | `server/src/routes/reports.ts:138-161` | ❌ Open |
| 47 | **No debounce on audit logs search** — fires API request per keystroke | `web/src/pages/AuditLogsPage.tsx:53-58` | ❌ Open |
| 48 | **`useAuth` query fires even with no token** — doomed request on every mount | `web/src/hooks/useAuth.ts:28-39` | ❌ Open |
| 49 | **Existing variant edits silently dropped** — no API call made for edited variants | `web/src/components/ProductForm.tsx:276-298` | ❌ Open |
| 50 | **Duplicate `notifRef` in Layout** — desktop notification click-outside broken | `web/src/components/Layout.tsx:94,174` | ❌ Open |
| 51 | **`adjustedBy` is free-text in StockAdjustDialog** — not derived from session | `web/src/components/StockAdjustDialog.tsx:31` | ❌ Open |
| 52 | **`useStocktake('')` fires with empty ID** when modal closed — invalid API call | `web/src/pages/StocktakesPage.tsx:100` | ❌ Open |
| 53 | **`usePurchaseOrder('')` fires with empty ID** — same issue | `web/src/pages/PurchaseOrdersPage.tsx:87` | ❌ Open |
| 54 | **Webhook secret shown in plaintext input** — should use `type="password"` | `web/src/pages/WebhookConfigsPage.tsx:210-219` | ❌ Open |
| 55 | **Falsy guard skips `page=0` and `limit=0`** in audit logs hook | `web/src/hooks/useAuditLogs.ts:39-40` | ❌ Open |
| 56 | **`<select>` not excluded from keyboard shortcuts** — pressing `n` in dropdown navigates away | `web/src/hooks/useKeyboardShortcuts.ts:8-19` | ❌ Open |
| 57 | **`item.variantId \|\| ''` fallback in ReturnsPage** — falsy variantIds collide as empty-string keys | `web/src/pages/ReturnsPage.tsx:174,187,195,215,228` | ❌ Open |
| 58 | **`useOrders({ limit: '50' })` in ReturnsPage** — orders beyond 50 not selectable | `web/src/pages/ReturnsPage.tsx:78` | ❌ Open |
| 59 | **`UserForm` stale state** when `user` prop changes without unmount | `web/src/components/UserForm.tsx:38` | ❌ Open |
| 60 | **Nested `<button>` in PickListTable** — invalid HTML, unpredictable behavior | `web/src/components/PickListTable.tsx:101-122` | ❌ Open |
| 61 | **Race condition in variant removal** — UI removes before API confirms, no rollback on failure | `web/src/components/ProductForm.tsx:200-223` | ❌ Open |
| 62 | **`unlink` errors silently swallowed** in product image delete | `server/src/routes/products.ts:496-498` | ❌ Open |
| 63 | **Redundant `manager.save(orderItems)`** — already individually saved, N+1 extra UPDATEs | `server/src/services/orderProcessor.ts:105` | ❌ Open |
| 64 | **`reports/orders-by-status` query can't use index** — `DATE("createdAt") = CURRENT_DATE` causes full scan | `server/src/routes/reports.ts:24` | ❌ Open |
| 65 | **Admin email leaked in login placeholder** — `admin@nicheinventory.local` | `web/src/pages/LoginPage.tsx:43` | ❌ Open |

## LOW

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 66 | **Pervasive `err: any` typing** — suppresses TypeScript safety across catch blocks | Multiple files | ❌ Open |
| 67 | **Duplicate interface definitions** — `InventoryLevel`, `Location` redefined across hooks | `useProducts.ts`, `useInventory.ts`, `useLocations.ts` | ❌ Open |
| 68 | **`useEffect` with no dependency array** as data-change detector — runs every render | `InventoryPage.tsx:59`, `ProductsPage.tsx:87`, `OrdersPage.tsx:234` | ❌ Open |
| 69 | **Dead code: `exportParams` computed but never used** | `web/src/pages/ProductsPage.tsx:211-214` | ❌ Open |
| 70 | **Magic number for low-stock threshold** — `available <= 5` hardcoded | `web/src/pages/InventoryPage.tsx:150,267` | ❌ Open |
| 71 | **Excessive `as any` casts** — suppresses real type errors | `InventoryPage.tsx:357-368`, `ProductForm.tsx:80,297,300` | ❌ Open |
| 72 | **`PDFDoc` typed as `any`** — eliminates TypeScript checking for PDF module | `server/src/utils/pdf.ts:6` | ❌ Open |
| 73 | **Incomplete log redaction** — passwords in request bodies not redacted | `server/src/utils/logger.ts:7` | ❌ Open |
| 74 | **OpenAPI spec publicly accessible** — consider restricting in production | `server/src/utils/openapi.ts:647-649` | ❌ Open |
| 75 | **Close button uses rotated Trash2 icon** instead of X — confusing UX | `web/src/pages/StocktakesPage.tsx:63,126` | ❌ Open |
| 76 | **`type` and `address` set to `null`** instead of `undefined` in LocationsPage | `web/src/pages/LocationsPage.tsx:99-103` | ❌ Open |
| 77 | **`closeForm` missing from useEffect deps** | `LocationsPage.tsx:134`, `SuppliersPage.tsx:132` | ❌ Open |
| 78 | **Array index as `key`** in PurchaseOrdersPage item list | `web/src/pages/PurchaseOrdersPage.tsx:474` | ❌ Open |
| 79 | **Aggressive 10s polling in usePickList** — combined with no AbortController | `web/src/hooks/usePickList.ts:21` | ❌ Open |
| 80 | **`setLimit` accepts 0 or negative values** | `web/src/hooks/useUrlFilters.ts:121` | ❌ Open |
| 81 | **Unused `timingSafeEqual` import** | `server/src/services/webhooks.ts:1` | ❌ Open |
| 82 | **`sku` query param passed to ORM without UUID validation** | `server/src/routes/inventory.ts:39` | ❌ Open |
| 83 | **Duplicate `nextStatus`/`nextLabel` lookup tables** in OrdersPage | `web/src/pages/OrdersPage.tsx:386-392,682-696` | ❌ Open |
| 84 | **Double success feedback** — toast + inline banner in SettingsPage | `web/src/pages/SettingsPage.tsx:40-54` | ❌ Open |
| 85 | **Hardcoded chart title "Last 30 Days"** may not match actual data range | `web/src/pages/ReportsPage.tsx:100-101` | ❌ Open |
| 86 | **Stocktake completion silently skips uncounted items** — no warning to user | `server/src/routes/stocktakes.ts:135` | ❌ Open |
| 87 | **`webhooks/config` pre-populates secret on edit** — masked value may overwrite real secret | `web/src/pages/WebhookConfigsPage.tsx:45` | ❌ Open |
| 88 | **Unbounded SKU `WHERE ... OR` clause** in pick list PDF generation | `server/src/routes/pickList.ts:58-61` | ❌ Open |
| 89 | **Missing `errorHandler` in several route files** — inconsistent pattern | `alerts.ts`, `notifications.ts`, `auditLogs.ts`, `pickList.ts`, `webhookConfigs.ts` | ❌ Open |
| 90 | **`removeFilter` destructured but never used** | `web/src/pages/OrdersPage.tsx:201` | ❌ Open |
| 91 | **Unused repository helper functions** — module-level repos never used | `transfers.ts:16-18`, `stocktakes.ts:16-19`, `returns.ts:16-18` | ❌ Open |
| 92 | **String entity reference** `'Order'` instead of class in returns route | `server/src/routes/returns.ts:73` | ❌ Open |
| 93 | **Audit actions use string casts** instead of enum values in purchaseOrders | `server/src/routes/purchaseOrders.ts:142,169,191,262,290` | ❌ Open |
