# Niche Inventory — Roadmap v2

> Generated: 2026-05-22
> Based on: Full project analysis (`docs/project-analysis.md`), BUGS.md (93 issues), original ROADMAP.md
> Project state: Phase 7 ~60% complete, 80 open bugs remaining

---

## What Changed

Phases 1–6 are substantially complete. This roadmap focuses on what's actually left:
- **80 open bugs** (20 high, 32 medium, 28 low)
- **Remaining items** from original Phase 7
- **New features** identified during analysis

---

## Phase 8 — Critical & High-Priority Fixes (Est: 1–2 days)

> Goal: Fix all data integrity and security bugs. Zero new features — just harden.

### 8.1 Transaction Safety
- [ ] Wrap product creation in `AppDataSource.transaction()` (#14)
- [ ] Add pessimistic locks to transfer completion destination inventory (#23)
- [ ] Check source inventory exists before transfer — fail if missing, don't create phantom stock (#24)
- [ ] Add pessimistic lock on webhook order inventory reservation (#25)
- [ ] Move email sending after transaction commit in orderProcessor (#26)

### 8.2 Security Hardening
- [ ] Derive `adjustedBy` from JWT session, reject client-supplied value (#16)
- [ ] Add role check to `DELETE /users/:id` — only admin can delete (#19)
- [ ] Fix XSS in email templates — escape external data with proper HTML entities (#27)
- [ ] Sanitize PDF filenames to prevent HTTP header injection (#28)
- [ ] Fix OpenAPI security config — mark auth-required endpoints properly (#29)

### 8.3 Input Validation & State Machines
- [ ] Validate order status with zod enum before processing — no raw `as OrderStatus` cast (#18)
- [ ] Reject silent stock underflow — throw error instead of `Math.max(0, ...)` (#17)
- [ ] Fix bulk status update to use same state machine + pessimistic locks as single status (#20)
- [ ] Replace generic `PATCH /purchase-orders/:id` with specific state transition endpoints (#21)
- [ ] Add dependency check before location deletion (#22)

### 8.4 Performance Fix
- [ ] Move `stockStatus` filtering to SQL subquery instead of loading all products (#15)

---

## Phase 9 — Medium-Priority Fixes & UX Polish (Est: 2–3 days)

> Goal: Fix functional bugs, improve consistency, polish UX.

### 9.1 Backend Consistency
- [ ] Sanitize CSV exports against formula injection (#34)
- [ ] Escape LIKE wildcards in search queries (#35)
- [ ] Remove search on UUID fields in transfers (#36)
- [ ] Consolidate RBAC double DB lookup to single query (#37)
- [ ] Fix inconsistent error shapes in notifications (#38) and webhookConfigs (#39)
- [ ] Add SKU uniqueness check on product/variant creation (#40)
- [ ] Validate file extension server-side, not from client MIME type (#41)
- [ ] Fix pagination total when lowStock filter applied (#42)
- [ ] Fix stocktake item update — wrap in transaction (#44)
- [ ] Fix transfer stock deduction — reject underflow instead of clamping (#45)
- [ ] Fix inventory-valuation using INNER JOIN — use LEFT JOIN (#46)
- [ ] Fix reports/orders-by-status query to use indexable date comparison (#64)
- [ ] Fix redundant `manager.save(orderItems)` in orderProcessor (#63)
- [ ] Add missing errorHandler import in 5 route files (#89)
- [ ] Remove unused repository helpers (#91)
- [ ] Fix string entity reference in returns route (#92)
- [ ] Fix audit action string casts in purchaseOrders (#93)

### 9.2 Frontend Bug Fixes
- [ ] Add debounce to audit log search (#47)
- [ ] Fix `useAuth` firing without token (#48)
- [ ] Fix variant edits silently dropped in ProductForm (#49)
- [ ] Fix duplicate `notifRef` in Layout (#50)
- [ ] Remove `adjustedBy` free-text from StockAdjustDialog (#51)
- [ ] Fix `useStocktake('')` and `usePurchaseOrder('')` empty ID queries (#52, #53)
- [ ] Use `type="password"` for webhook secret input (#54)
- [ ] Fix falsy guard skipping `page=0` in audit logs hook (#55)
- [ ] Exclude `<select>` from keyboard shortcuts (#56)
- [ ] Fix falsy variantId collision in ReturnsPage (#57)
- [ ] Fix orders limited to 50 in ReturnsPage (#58)
- [ ] Fix UserForm stale state on prop change (#59)
- [ ] Fix nested `<button>` in PickListTable (#60)
- [ ] Fix variant removal race condition in ProductForm (#61)
- [ ] Fix admin email leaked in login placeholder (#65)

### 9.3 UX Improvements
- [ ] Replace rotated Trash2 icon with X for close buttons (#75)
- [ ] Fix null vs undefined for type/address in LocationsPage (#76)
- [ ] Add missing `closeForm` to useEffect deps (#77)
- [ ] Fix array index keys in PurchaseOrdersPage (#78)
- [ ] Reduce pickList polling from 10s to 30s with visibility API (#79)
- [ ] Clamp `setLimit` to minimum 1 (#80)
- [ ] Remove unused `timingSafeEqual` import (#81)
- [ ] Validate SKU as UUID in inventory search (#82)
- [ ] Deduplicate nextStatus/nextLabel tables in OrdersPage (#83)
- [ ] Fix double success feedback in SettingsPage (#84)
- [ ] Make chart title match actual date range (#85)
- [ ] Warn on stocktake completion with uncounted items (#86)
- [ ] Fix webhook secret pre-population on edit (#87)

### 9.4 Frontend Resilience
- [ ] Add AbortController to API client (#30)
- [ ] Fix `openAuthenticatedUrl` to redirect on refresh failure (#32)
- [ ] Fix `authFetch` to use `apiFetch` properly (#33)
- [ ] Fix useEffect with no dependency arrays in Inventory/Products/Orders pages (#68)
- [ ] Remove dead `exportParams` in ProductsPage (#69)
- [ ] Use product.lowStockThreshold instead of hardcoded `5` (#70)

---

## Phase 10 — Code Quality & Type Safety (Est: 1–2 days)

> Goal: Make the codebase robust and maintainable.

### 10.1 Type Safety
- [ ] Replace pervasive `err: any` with proper error typing (#66)
- [ ] Extract shared TypeScript interfaces — eliminate duplicate definitions (#67)
- [ ] Add proper type for `PDFDoc` instead of `any` (#72)
- [ ] Remove excessive `as any` casts (#71)

### 10.2 Security Improvements
- [ ] Enforce stronger password policy (#43)
- [ ] Redact passwords in request body logging (#73)
- [ ] Restrict OpenAPI spec in production (#74)

### 10.3 Testing
- [ ] Add backend unit tests for service layer
- [ ] Add frontend tests with vitest + testing-library
- [ ] Add E2E test for transfers, returns, and purchase orders

---

## Phase 11 — New Features (Est: 2–4 weeks)

> Goal: Add features that make this competitive with commercial inventory systems.

### 11.1 Auth Improvements
- [ ] Forgot-password flow (email-based reset)
- [ ] Replace localStorage tokens with httpOnly cookies

### 11.2 Data Import
- [ ] CSV/Excel import for products (with validation, duplicate detection, preview before commit)
- [ ] CSV/Excel import for inventory levels

### 11.3 Enhanced Reporting
- [ ] PDF report generation (sales summary, inventory snapshot)
- [ ] Scheduled/automated reports
- [ ] Date range picker on all report charts
- [ ] Custom KPI dashboard (user-configurable widgets)

### 11.4 Workflow Enhancements
- [ ] Auto-generate purchase order suggestions when stock drops below threshold
- [ ] Reorder point system per product
- [ ] Supplier lead time tracking
- [ ] Supplier detail page with linked products

### 11.5 Image Storage
- [ ] S3-compatible storage (Cloudflare R2 / OVH)
- [ ] Image optimization and thumbnails

### 11.6 Integrations
- [ ] ShipStation / EasyPost API for shipping labels
- [ ] Accounting software export (QuickBooks, Xero)
- [ ] Shopify / WooCommerce order sync

### 11.7 PWA & Mobile
- [ ] PWA manifest + service worker
- [ ] Offline-capable pick list
- [ ] Mobile-optimized workflows

### 11.8 Developer Experience
- [ ] ESLint + Prettier, enforce in CI
- [ ] Monorepo tooling (shared types package)
- [ ] CONTRIBUTING.md
- [ ] Redis caching for frequently accessed data

---

## Phase 12 — Scale & Operations (Est: 1–2 weeks)

> Goal: Production-ready at scale.

- [ ] Redis caching layer
- [ ] Virtual scrolling for large tables (`@tanstack/react-virtual`)
- [ ] Prometheus metrics endpoint
- [ ] Sentry for frontend error tracking
- [ ] Staging/production deployment pipeline
- [ ] WAL archiving for point-in-time recovery
- [ ] i18n foundation (i18next)
- [ ] Rate limiting backed by Redis (multi-instance safe)

---

## Execution Order

```
Phase 8 (Bug fixes)     ← DO NOW — blocks everything else
  ↓
Phase 9 (Polish)        ← DO NOW — UX quality
  ↓
Phase 10 (Code quality) ← After bugs are fixed
  ↓
Phase 11 (New features) ← Per-user demand
  ↓
Phase 12 (Scale)        ← When needed
```

Phases 8 and 9 can be partially parallelized — backend fixes (8.1–8.4, 9.1) run independently from frontend fixes (9.2–9.4).
