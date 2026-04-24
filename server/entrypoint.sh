#!/bin/sh
set -e

echo "Running database migrations..."
npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts

echo "Seeding admin user if needed..."
bun run src/scripts/seed-admin.ts || true

echo "Starting server..."
exec npx tsx src/index.ts
