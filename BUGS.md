# Bug Audit — 2026-04-26

## CRITICAL

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | **Refresh token accepted as access token** — `verifyAccessToken` now rejects tokens with `type: 'refresh'` | `server/src/services/auth.ts:43-53` | ✅ Fixed |
| 2 | **Insecure JWT secret default** — Removed `'change-me-in-production'` fallback, now throws at runtime if unset | `server/src/services/auth.ts:7-11` | ✅ Fixed |
| 3 | **Webhook auth bypassed when no secret configured** — Now returns 500 if `WEBHOOK_SECRET` is missing | `server/src/routes/webhooks.ts:40-42` | ✅ Fixed |
| 4 | **JWT leaked in URL query params** — Replaced with fetch-based download using `Authorization` header + blob download | `web/src/api/client.ts:128-162` | ✅ Fixed |

## HIGH

| # | Issue | Location |
|---|-------|----------|
| 5 | **No rate limiting on login** — `POST /auth/login` is wide open to brute force | `server/src/index.ts` |
| 6 | **RBAC uses stale role from JWT** — demoted users retain old privileges until token expires | `server/src/middleware/rbac.ts:20-24` |
| 7 | **`ROLE_PERMISSIONS` defined but never enforced** — resource-level auth is dead code | `server/src/middleware/rbac.ts:5-16` |
| 8 | **`useEffect` fires every render** when query data is undefined — inline `[]` fallback creates new reference, clearing selection on each render | `InventoryPage.tsx:66`, `ProductsPage.tsx:121`, `OrdersPage.tsx:233` |
| 9 | **ProductsPage bulk delete ConfirmModal opens on any selection** instead of on button click; actual delete button has no confirmation | `ProductsPage.tsx:333` |
| 10 | **`apiUpload` skips 401 token refresh** — image uploads fail when access token expires | `web/src/api/client.ts:100-121` |

## MEDIUM

| # | Issue | Location |
|---|-------|----------|
| 11 | **Webhook signature uses `===` instead of `timingSafeEqual`** — vulnerable to timing attacks | `server/src/routes/webhooks.ts:26-30` | ✅ Fixed |
| 12 | **Internal error messages leaked to clients** — TypeORM/DB errors returned verbatim + string-match heuristics misclassify status codes | `server/src/middleware/error-handler.ts:15-28` |
| 13 | **No refresh token rotation/revocation** — stolen refresh tokens valid for full 7-day window | `server/src/services/auth.ts:33` |
| 14 | **ReportsPage uses fabricated chart data** — "Shipped" count is `totalOrders - pending - 5`, "Other" hardcoded to `5` | `ReportsPage.tsx:61-65` |
| 15 | **Revenue and order count on same Y-axis** — makes smaller values invisible | `ReportsPage.tsx:119-120` |
| 16 | **BarcodeScanner restarts camera every render** — `onScan` callback not memoized in deps | `BarcodeScanner.tsx:84` + `ProductsPage.tsx:114` |
| 17 | **`apiFetch` headers silently overwritten** by `options` containing `headers` | `web/src/api/client.ts:63-69` |
| 18 | **SettingsPage profile/password use raw `fetch`** — skip token refresh logic | `SettingsPage.tsx:38`, `useUsers.ts:63` |
| 19 | **`StocktakeCountModal` uses `defaultValue`** — shows stale values after mutation | `StocktakesPage.tsx:144` |
| 20 | **`ProfileTab` inputs don't sync** when `user` data changes after mount | `SettingsPage.tsx:21-22` |

## LOW

| # | Issue | Location |
|---|-------|----------|
| 21 | **Logout is a no-op** — tokens remain valid after "logout" | `server/src/routes/auth.ts:50-53` |
| 22 | **`Bearer` extraction is case-sensitive** — violates RFC 7235 | `jwt-auth.ts:19` |
| 23 | **`JSON.parse` in webhook throws 500** instead of 400 | `webhooks.ts:49` |
| 24 | **Dead code: `middleware/auth.ts`** never imported | `server/src/middleware/auth.ts` |
| 25 | **Excessive `err: any`** in 20+ catch blocks suppresses type safety | Multiple files |
| 26 | **`PaginatedResponse<T>` duplicated** across 9 hook files | Multiple hooks |
