# Task: Add API Documentation with Swagger UI

## What to do
Add Swagger UI at `/docs` with a manually curated OpenAPI spec listing all API endpoints. Use @hono/swagger-ui.

## Files to create/modify

### 1. Install dependency
```bash
cd server && bun add @hono/swagger-ui
```

### 2. Create `server/src/utils/openapi.ts`
This file should export a `setupDocs(app: Hono)` function that:
- Registers `app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }))`
- Registers `app.get('/docs/openapi.json', ...)` that returns a complete OpenAPI 3.1.0 spec

The spec should include:
- Info: title "Niche Inventory API", version "1.0.0"
- Server: { url: '/', description: 'Current server' }
- Security: bearerAuth (http bearer JWT)
- Tags for all route groups: Auth, Products, Inventory, Orders, Locations, Transfers, Stocktakes, Pick List, Alerts, Audit Logs, Reports, Notifications, Webhooks, Users, Suppliers, Purchase Orders, Returns, Bulk
- Paths for ALL endpoints. Here are all the endpoints to document:

Auth (no auth required):
- POST /auth/login
- POST /auth/refresh  
- POST /auth/logout
- GET /auth/me
- PATCH /auth/profile

Products (admin, manager):
- GET /api/products
- POST /api/products
- GET /api/products/{id}
- PUT /api/products/{id}
- DELETE /api/products/{id}
- POST /api/products/{id}/images

Inventory (admin, manager, warehouse):
- GET /api/inventory
- POST /api/inventory/adjust

Orders (admin, manager, warehouse):
- GET /api/orders
- POST /api/orders
- GET /api/orders/{id}
- PATCH /api/orders/{id}/status

Locations:
- GET /api/locations
- POST /api/locations
- PUT /api/locations/{id}
- DELETE /api/locations/{id}

Transfers:
- GET /api/transfers
- POST /api/transfers
- PATCH /api/transfers/{id}/status

Stocktakes:
- GET /api/stocktakes
- POST /api/stocktakes
- PATCH /api/stocktakes/{id}/complete

Pick List:
- GET /api/pick-list
- PATCH /api/pick-list/{id}/pick

Alerts:
- GET /api/alerts

Audit Logs:
- GET /api/audit-logs

Reports:
- GET /api/reports/inventory-value
- GET /api/reports/movement
- GET /api/reports/export/csv

Notifications:
- GET /api/notifications
- PATCH /api/notifications/{id}/read
- POST /api/notifications/read-all

Webhooks:
- GET /api/webhooks/config
- POST /api/webhooks/config
- PATCH /api/webhooks/config/{id}
- DELETE /api/webhooks/config/{id}
- POST /webhooks/orders (public)

Users (admin only):
- GET /api/users
- POST /api/users
- PATCH /api/users/{id}
- DELETE /api/users/{id}

Suppliers:
- GET /api/suppliers
- POST /api/suppliers
- PUT /api/suppliers/{id}
- DELETE /api/suppliers/{id}

Purchase Orders:
- GET /api/purchase-orders
- POST /api/purchase-orders
- PATCH /api/purchase-orders/{id}/status

Returns:
- GET /api/returns
- POST /api/returns
- PATCH /api/returns/{id}/status

Bulk:
- POST /api/bulk/adjust

Health:
- GET /health

For each endpoint, include: summary, tag, and appropriate responses (200, 401, 400 where relevant).

### 3. Modify `server/src/index.ts`
- Import setupDocs: `import { setupDocs } from './utils/openapi';`
- Call `setupDocs(app);` AFTER cors setup but BEFORE route registrations
- Place it right after the cors() line and before the webhookRoute import/usage

## Constraints
- Do NOT modify any test files
- Do NOT modify any route handler logic
- The /docs routes must be PUBLIC (no JWT required)
- Swagger UI CSS/JS should be served by the @hono/swagger-ui package

## Verification
- `cd server && bun test tests/*.test.ts` — all tests pass
- The TypeScript should compile: `cd server && npx tsc --noEmit`

Print DONE_WORKING when finished.
