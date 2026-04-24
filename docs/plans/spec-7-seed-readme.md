# Task: Seed Script + README + Backup Script

## What to do
1. Create a comprehensive seed script that generates demo data
2. Write a full README.md
3. Update .env.example with all vars
4. Create a pg_dump backup shell script

## Files to create/modify

### 1. Read the existing seed-admin.ts first
Read `server/src/scripts/seed-admin.ts` to understand the pattern used for creating the admin user. Follow the same pattern.

### 2. Create `server/src/scripts/seed.ts`
A comprehensive seeder that:
- Imports and initializes AppDataSource
- Is idempotent: checks if data exists before inserting (use findOne or count)
- Creates demo data in this order (respecting FK constraints):
  1. Admin user (if not exists) — same as seed-admin.ts
  2. 2 additional users (manager + warehouse role)
  3. 3 warehouse locations (Main Warehouse, East Wing, Cold Storage)
  4. 5 products with realistic names and SKUs (e.g., "Organic Cotton T-Shirt", "Wireless Bluetooth Speaker", etc.)
  5. 8-10 product variants across those products (size/color variations)
  6. 15-20 inventory levels across locations and variants
  7. 8-10 orders in various statuses (pending, processing, shipped, delivered)
  8. 3-5 suppliers
  9. 2-3 purchase orders
- Log progress with console.log
- Exit cleanly after completion
- Export seed function so it can be imported if needed

### 3. Update `server/package.json`
Add script: `"db:seed": "bun run src/scripts/seed.ts"`

### 4. Update `.env.example`
Current content has: DATABASE_URL, POSTGRES_PASSWORD, PORT, JWT_SECRET, WEBHOOK_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ALLOWED_ORIGINS
Add these missing variables with comments:
```
# Application
NODE_ENV=development

# Logging
LOG_LEVEL=debug

# SMTP (for email notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# File Uploads
UPLOAD_DIR=./uploads
```

### 5. Create `README.md`
Write a professional README with these sections:

```markdown
# Niche Inventory

A full-featured inventory management system built with modern web technologies.

## Features

- **Product Management** — Products with variants, SKUs, barcode support, and image uploads
- **Inventory Tracking** — Real-time stock levels across multiple warehouse locations
- **Order Management** — Full order lifecycle: pending → processing → shipped → delivered
- **Warehouse Operations** — Stock transfers between locations, stocktakes, pick lists
- **Purchase Orders** — Supplier management, PO tracking, receiving workflow
- **Returns Processing** — Return requests, restocking, refund tracking
- **Business Intelligence** — Inventory value reports, movement reports, CSV export
- **User Management** — Role-based access control (admin, manager, warehouse)
- **Notifications** — In-app notifications, email alerts for low stock
- **Audit Trail** — Complete activity logging for compliance
- **API Documentation** — Interactive Swagger UI at `/docs`
- **Webhook Integration** — Outbound webhooks for order events

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono, TypeORM, PostgreSQL, Bun |
| Frontend | React, Vite, TailwindCSS, React Query |
| Auth | JWT (access + refresh tokens), bcrypt |
| Deployment | Docker, nginx |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Bun](https://bun.sh/) 1.3+ (for local development)

## Quick Start

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd niche-inventory
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Start with Docker:
   ```bash
   docker compose up -d
   ```

4. Access the app at `http://localhost`
   - Default login: admin@nicheinventory.local / (password from .env ADMIN_PASSWORD)

## Local Development

1. Start the database:
   ```bash
   docker compose up -d db
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   ```

4. Initialize the database:
   ```bash
   cd server && bun run db:sync
   bun run db:seed:admin
   ```

5. Start development servers:
   ```bash
   # Terminal 1 — Backend (port 3002)
   cd server && bun run dev
   # Terminal 2 — Frontend (port 5173)
   cd web && bun run dev
   ```

## Seeding Demo Data

```bash
cd server
bun run db:seed:admin  # Admin user only
bun run db:seed        # Full demo data (products, orders, etc.)
```

## Environment Variables

See [.env.example](.env.example) for all available variables.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `PORT` | Server port | 3002 |
| `JWT_SECRET` | Secret for JWT signing | — |
| `NODE_ENV` | Environment | development |
| `LOG_LEVEL` | Log level (debug/info/warn/error) | debug |
| `SMTP_*` | Email configuration | — |

## API Documentation

When the server is running, visit `/docs` for interactive Swagger UI documentation.

## Testing

```bash
cd server && bun test
```

## Project Structure

```
niche-inventory/
├── server/                  # Hono backend
│   ├── src/
│   │   ├── entities/        # TypeORM entities
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Auth, RBAC, error handling
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utilities (logging, etc.)
│   │   └── migrations/      # DB migrations
│   └── tests/               # Integration tests
├── web/                     # React frontend
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/           # React Query hooks
│   │   ├── pages/           # Page components
│   │   └── utils/           # Frontend utilities
├── scripts/                 # Utility scripts
├── docker-compose.yml
└── ROADMAP.md               # Development roadmap
```

## Deployment

The app runs in Docker with three services:
- **db** — PostgreSQL 17 with health checks
- **server** — Bun backend on port 3002
- **web** — nginx serving React build on port 80

```bash
docker compose up -d --build
```

## License

MIT
```

### 6. Create `scripts/backup.sh`
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/niche_inventory_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "Starting database backup..."
docker compose exec -T db pg_dump -U postgres niche_inventory | gzip > "$FILENAME"

# Keep last 30 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

SIZE=$(du -h "$FILENAME" | cut -f1)
echo "Backup saved: $FILENAME ($SIZE)"
echo "Keeping last 30 days of backups"
```
Make it executable: `chmod +x scripts/backup.sh`

### 7. Update `.gitignore`
Add these entries:
```
backups/
uploads/
```

## Constraints
- Do NOT modify any source code files (only create new files + update config/docs)
- The seed script must be idempotent
- The README must reflect the ACTUAL project structure (read the real files to confirm)

## Verification
- `cd server && bun run db:seed` should work (creates demo data without errors)
- `scripts/backup.sh` should be executable

Print DONE_WORKING when finished.
