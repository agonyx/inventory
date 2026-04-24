#!/bin/sh
set -e

echo "Running database setup..."
npx tsx src/scripts/setup-db.ts

echo "Seeding admin user if needed..."
npx tsx src/scripts/seed-admin.ts 2>/dev/null || echo "Admin seed skipped"

echo "Starting server..."
exec npx tsx src/index.ts
