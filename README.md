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
