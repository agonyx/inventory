# Task: Add Structured Logging with Pino

## What to do
Replace all console.log/console.error with pino structured JSON logging. Add a request logging middleware that logs method, path, status, duration (ms), and userId for every request.

## Files to create/modify

### 1. Install dependencies
```bash
cd server && bun add pino && bun add -d pino-pretty
```

### 2. Create `server/src/utils/logger.ts`
```ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
```

### 3. Create `server/src/middleware/request-logger.ts`
A Hono middleware that:
- Records `Date.now()` before `next()`
- After next(), calculates duration = Date.now() - start
- Gets userId from `c.get('jwtPayload')?.sub` (may be null for unauthenticated requests)
- Calls `logger.info({ method, path, status, duration, userId }, 'method path')`
- This should be a Hono MiddlewareHandler

### 4. Modify `server/src/index.ts`
- Import logger from './utils/logger'
- Import requestLogger from './middleware/request-logger'
- Add `app.use('*', requestLogger);` BEFORE the auth middleware line (before `app.use('/api/*', jwtAuth)`)
- Replace the 3 console.log/error calls:
  - "Database connected" → `logger.info('Database connected')`
  - `Server running on http://localhost:${port}` → `logger.info({ port }, 'Server running')`
  - `Failed to start:` → `logger.error({ err }, 'Failed to start')` (note: pass err as object for proper serialization)

### 5. Modify `server/src/middleware/error-handler.ts`
- Import logger from '../utils/logger'
- Replace `console.error('Request error:', err);` with `logger.error({ err, path: c.req.path }, 'Request error');`
- Note: pino's serializers handle Error objects automatically when passed as `err`

## Constraints
- Do NOT modify any test files
- Do NOT modify any route files
- Do NOT change any business logic
- The request-logger middleware MUST be placed before the jwt-auth middleware so it logs both authenticated and unauthenticated requests

## Verification
Run: `cd server && bun test tests/*.test.ts`
All 187 tests should pass. If any test fails, check that the logging changes don't affect response bodies.

Print DONE_WORKING when finished.
