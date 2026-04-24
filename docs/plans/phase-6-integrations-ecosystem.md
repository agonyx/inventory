# Phase 6 — Integrations & Ecosystem Implementation Plan

> **For Hermes:** Use OpenCode orchestration to implement this plan sub-phase by sub-phase.

**Goal:** Connect to external systems and extend the inventory platform with suppliers, purchase orders, shipping, returns, and email notifications.

**Architecture:** Follow existing patterns — UUID PKs, TypeORM entities, Hono routes with zValidator, React Query hooks, Tailwind UI pages. All new entities get AuditAction entries. RBAC follows existing role permissions.

**Tech Stack:** Hono, TypeORM, PostgreSQL, React, Vite, TailwindCSS, Zod, React Query, Lucide icons, Sonner toasts

---

## Execution Order

```
6.2 Supplier Management  ──┐
                           ├──→ 6.3 Purchase Orders (depends on 6.2)
6.4 Shipping Integration  ──┤
6.5 Returns / RMAs       ──┤
6.1 Product Images        ──┤  (independent, needs S3 env vars)
6.6 Email Notifications   ──┘  (independent, needs SMTP/Resend env vars)
```

### Parallel Wave 1: 6.2 + 6.4 + 6.5 (no deps)
### Wave 2: 6.3 (needs 6.2)
### Wave 3: 6.1 + 6.6 (need env configuration)

---

## 6.2 Supplier Management

### Entity: `server/src/entities/Supplier.ts`
- `id: string` (uuid PK)
- `name: string` (varchar 255, NOT NULL)
- `contactName: string` (varchar 255, nullable)
- `email: string` (varchar 255, nullable)
- `phone: string` (varchar 50, nullable)
- `address: string` (text, nullable)
- `notes: string` (text, nullable)
- `createdAt`, `updatedAt`
- OneToMany → Product

### Modify: `server/src/entities/Product.ts`
- Add `supplierId: string` (uuid, nullable FK → suppliers.id)
- Add `@ManyToOne('Supplier')` + `@JoinColumn({ name: 'supplierId' })`

### Routes: `server/src/routes/suppliers.ts`
- Standard CRUD: GET / (paginated, searchable by name), GET /:id, POST, PATCH /:id, DELETE /:id
- RBAC: admin, manager
- Zod schemas: createSupplierSchema, updateSupplierSchema
- Sort by: name, createdAt
- DELETE check: throw CONFLICT if products reference this supplier

### Frontend hook: `web/src/hooks/useSuppliers.ts`
- useSuppliers(params), useSupplier(id), useCreateSupplier(), useUpdateSupplier(), useDeleteSupplier()

### Frontend page: `web/src/pages/SuppliersPage.tsx`
- Table with columns: name, contact, email, phone, product count
- Create/Edit modal form
- Delete confirmation
- FilterBar: search by name
- Standard FilterBar + Pagination + SkeletonTable

### Registration
- `server/src/index.ts`: add RBAC + route for `/api/suppliers`
- `server/src/data-source.ts`: register Supplier entity
- `web/src/App.tsx`: add `/suppliers` route
- `web/src/components/Layout.tsx`: add nav item (admin, manager)
- `web/src/components/ProductForm.tsx`: add supplier dropdown

### Tests: `server/src/__tests__/suppliers.test.ts`
- CRUD operations, search, delete with products (expect conflict)

---

## 6.3 Purchase Orders

### Entity: `server/src/entities/PurchaseOrder.ts`
- `id: string` (uuid PK)
- `supplierId: string` (uuid FK → suppliers.id, NOT NULL)
- `status: PurchaseOrderStatus` (enum: draft/sent/partially_received/received/cancelled)
- `notes: string` (text, nullable)
- `createdAt`, `updatedAt`
- ManyToOne → Supplier
- OneToMany → PurchaseOrderItem

### Entity: `server/src/entities/PurchaseOrderItem.ts`
- `id: string` (uuid PK)
- `purchaseOrderId: string` (uuid FK → purchase_orders.id)
- `variantId: string` (uuid FK → product_variants.id)
- `quantity: number` (int, NOT NULL)
- `receivedQuantity: number` (int, default 0)
- `unitCost: number` (decimal 10,2)
- ManyToOne → PurchaseOrder, ManyToOne → ProductVariant

### Routes: `server/src/routes/purchaseOrders.ts`
- GET / (paginated, filter by status, supplier)
- GET /:id (with items loaded)
- POST / (create PO with items in transaction)
- PATCH /:id (update notes, status changes)
- POST /:id/send (draft → sent)
- POST /:id/receive (partial/full receiving, adjusts inventory in transaction)
- POST /:id/cancel (cancel PO)
- DELETE /:id (only if draft)
- RBAC: admin, manager

### Receive workflow:
```
POST /:id/receive { items: [{ itemId, quantityReceived }] }
- Transaction:
  - Update PurchaseOrderItem.receivedQuantity
  - Adjust inventory levels (create or update InventoryLevel)
  - Create audit logs
  - If all items fully received → auto-set status to 'received'
  - If partially → set to 'partially_received'
```

### Frontend hook: `web/src/hooks/usePurchaseOrders.ts`
- Standard CRUD + useReceivePO(), useSendPO(), useCancelPO()

### Frontend page: `web/src/pages/PurchaseOrdersPage.tsx`
- Table: PO# (id truncated), supplier, status badge, total items, created date
- Status filter, search
- Create form: select supplier, add items (variant + qty + unitCost)
- Detail view / modal: items list with received qty, receive button
- Receive modal: per-item quantity received inputs

### AuditAction additions
- `create_purchase_order`, `update_purchase_order`, `receive_purchase_order`, `cancel_purchase_order`

---

## 6.4 Shipping Integration

### Modify: `server/src/entities/Order.ts`
- Add `trackingNumber: string` (varchar 255, nullable)
- Add `shippingCarrier: string` (varchar 50, nullable)

### Carrier URL templates:
```ts
const CARRIER_URLS: Record<string, (tracking: string) => string> = {
  dhl: (t) => `https://www.dhl.com/track?id=${t}`,
  ups: (t) => `https://www.ups.com/track?tracknum=${t}`,
  fedex: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  usps: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  royal_mail: (t) => `https://www.royalmail.com/track-your-item/?trackNumber=${t}`,
};
```

### Routes: Add to `server/src/routes/orders.ts`
- PATCH /:id/shipping — set trackingNumber + shippingCarrier
- GET /:id/tracking-url — returns computed tracking URL

### Frontend:
- Modify `web/src/pages/OrdersPage.tsx` / Order detail: add tracking number input, carrier select
- Display tracking link (opens in new tab) when tracking number exists
- Add to `web/src/hooks/useOrders.ts`: useUpdateShipping()

### RBAC: admin, manager, warehouse (warehouse can update tracking)

---

## 6.5 Returns / RMAs

### Entity: `server/src/entities/Return.ts`
- `id: string` (uuid PK)
- `orderId: string` (uuid FK → orders.id)
- `reason: string` (text, NOT NULL)
- `status: ReturnStatus` (enum: requested/approved/received/refunded/rejected)
- `notes: string` (text, nullable)
- `createdAt`, `updatedAt`
- ManyToOne → Order
- OneToMany → ReturnItem

### Entity: `server/src/entities/ReturnItem.ts`
- `id: string` (uuid PK)
- `returnId: string` (uuid FK → returns.id)
- `variantId: string` (uuid FK → product_variants.id)
- `quantity: number` (int)
- `condition: ReturnItemCondition` (enum: new/damaged/used)
- ManyToOne → Return, ManyToOne → ProductVariant

### Routes: `server/src/routes/returns.ts`
- GET / (paginated, filter by status, order)
- GET /:id (with items)
- POST / (create return request from order)
- PATCH /:id/approve (approve return)
- PATCH /:id/reject (reject return)
- PATCH /:id/receive (mark items received, auto-adjust inventory)
- PATCH /:id/refund (mark as refunded)
- DELETE /:id (only if requested, not approved+)
- RBAC: admin, manager

### Receive workflow:
```
PATCH /:id/receive
- Transaction:
  - Set ReturnItem status to received
  - For each item: add quantity back to InventoryLevel (based on variant + location)
  - Create audit logs
  - Set Return.status = 'received'
```

### Frontend hook: `web/src/hooks/useReturns.ts`
- Standard CRUD + useApproveReturn(), useRejectReturn(), useReceiveReturn(), useRefundReturn()

### Frontend page: `web/src/pages/ReturnsPage.tsx`
- Table: Return# (id truncated), order#, reason, status badge, items count, date
- Status filter, search
- Create from order (pre-fill order items)
- Detail/expand: items with condition, approval/rejection buttons
- Receive confirmation

### AuditAction additions:
- `create_return`, `approve_return`, `reject_return`, `receive_return`, `refund_return`

---

## 6.1 Product Images

### Design Decision: Use local filesystem storage with upload endpoint
- Store images in `server/uploads/` directory (mapped as Docker volume)
- No S3 dependency — keeps it self-hosted and simple
- Can add S3 later without API changes

### Modify: `server/src/entities/Product.ts`
- Add `images: string[]` (simple-array column — stores relative paths like `/uploads/product-uuid/img1.jpg`)

### Upload route (add to `server/src/routes/products.ts`):
- POST /:id/images — multipart upload, saves file, appends path to product.images
- DELETE /:id/images/:index — removes image from array, deletes file
- GET /:id/images — returns images array
- Serve uploads: `app.serveStatic({ root: './uploads' })` in index.ts
- File validation: max 5MB, image mime types only (jpg, png, webp, gif)
- File naming: `product-{productId}-{timestamp}.{ext}`

### Dependencies: None — use Hono's built-in `c.req.parseBody()` for multipart

### Frontend:
- Modify `web/src/components/ProductForm.tsx`: add image upload dropzone + gallery
- Modify `web/src/components/ProductTable.tsx`: show first image as thumbnail
- New hook additions in `web/src/hooks/useProducts.ts`: useUploadProductImage(), useDeleteProductImage()

### RBAC: admin, manager

---

## 6.6 Email Notifications

### Design Decision: Resend API (simplest, modern, good free tier)
- Or SMTP fallback via `nodemailer`

### Env vars:
- `EMAIL_PROVIDER` — 'resend' | 'smtp'
- `RESEND_API_KEY` — Resend API key
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP config
- `NOTIFICATION_EMAIL_FROM` — sender address
- `NOTIFICATION_EMAIL_TO` — comma-separated list of recipients

### Service: `server/src/services/email.ts`
- `sendEmail(to: string, subject: string, html: string)` — provider-agnostic
- `sendLowStockAlert(products: Product[])` — template
- `sendOrderConfirmation(order: Order)` — template
- `sendShippingConfirmation(order: Order)` — template

### Email templates: simple HTML strings with inline styles (no template engine)

### Event hooks: integrate into existing services
- `orderProcessor.ts` → after order created: sendOrderConfirmation
- `routes/orders.ts` → after status change to shipped: sendShippingConfirmation
- `alerts.ts` → on low stock: sendLowStockAlert (batch daily, not per-alert)

### Settings: add email config to `server/src/routes/settings.ts` or env-only (no DB settings for now)

---

## File Checklist

### New files:
- `server/src/entities/Supplier.ts`
- `server/src/entities/PurchaseOrder.ts`
- `server/src/entities/PurchaseOrderItem.ts`
- `server/src/entities/Return.ts`
- `server/src/entities/ReturnItem.ts`
- `server/src/routes/suppliers.ts`
- `server/src/routes/purchaseOrders.ts`
- `server/src/routes/returns.ts`
- `server/src/services/email.ts`
- `server/src/__tests__/suppliers.test.ts`
- `server/src/__tests__/purchaseOrders.test.ts`
- `server/src/__tests__/returns.test.ts`
- `server/src/__tests__/shipping.test.ts`
- `server/src/__tests__/email.test.ts`
- `server/uploads/.gitkeep`
- `web/src/hooks/useSuppliers.ts`
- `web/src/hooks/usePurchaseOrders.ts`
- `web/src/hooks/useReturns.ts`
- `web/src/pages/SuppliersPage.tsx`
- `web/src/pages/PurchaseOrdersPage.tsx`
- `web/src/pages/ReturnsPage.tsx`

### Modified files:
- `server/src/entities/Product.ts` — add images, supplierId
- `server/src/entities/Order.ts` — add trackingNumber, shippingCarrier
- `server/src/entities/AuditLog.ts` — add new AuditAction enum values
- `server/src/routes/products.ts` — image upload endpoints
- `server/src/routes/orders.ts` — shipping update endpoint
- `server/src/index.ts` — register new routes, entities, serve static uploads
- `server/src/data-source.ts` — register new entities
- `server/src/middleware/rbac.ts` — add new resource permissions if needed
- `web/src/App.tsx` — add new routes
- `web/src/components/Layout.tsx` — add nav items
- `web/src/components/ProductForm.tsx` — supplier dropdown, image upload
- `web/src/components/ProductTable.tsx` — thumbnail, supplier column
- `web/src/hooks/useProducts.ts` — image upload/delete hooks
- `web/src/hooks/useOrders.ts` — shipping update hook
- `web/src/pages/OrdersPage.tsx` — tracking number UI
