# Task: GitHub Actions CI/CD

## What to do
Create GitHub Actions workflows for:
1. CI: type check + test on every PR and push to main
2. Docker: build and push Docker images on main push and tags

## Files to create

### 1. Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  server-checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: niche_inventory_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
        working-directory: server
      - name: Type check
        run: npx tsc --noEmit
        working-directory: server
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/niche_inventory_test
          JWT_SECRET: ci-test-secret
          NODE_ENV: test
      - name: Run tests
        run: for f in tests/*.test.ts; do echo "--- $f ---"; bun test "$f" || exit 1; done
        working-directory: server
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/niche_inventory_test
          JWT_SECRET: ci-test-secret
          WEBHOOK_SECRET: ci-test-whsec
          ADMIN_EMAIL: admin@test.com
          ADMIN_PASSWORD: TestPass123!
          NODE_ENV: test

  web-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
        working-directory: web
      - name: Type check
        run: npx tsc --noEmit
        working-directory: web
      - name: Build
        run: bun run build
        working-directory: web
```

### 2. Create `.github/workflows/docker.yml`

```yaml
name: Docker Build

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/') }}
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Constraints
- The CI workflow MUST use PostgreSQL service container for integration tests
- The server-checks job MUST set all required env vars (DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, NODE_ENV)
- Use oven-sh/setup-bun@v2 for Bun setup
- Do NOT modify any source code files

## Verification
- YAML files should be syntactically valid (just creating files, no way to test locally without pushing)
- Ensure the .github directory structure is correct

Print DONE_WORKING when finished.
