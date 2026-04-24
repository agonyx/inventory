import 'reflect-metadata';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppDataSource } from './data-source';
const app = new Hono();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));

import webhookRoute from './routes/webhooks';
import { errorHandler } from './middleware/error-handler';
import { jwtAuth } from './middleware/jwt-auth';
import productsRoute from './routes/products';
import inventoryRoute from './routes/inventory';
import locationsRoute from './routes/locations';
import ordersRoute from './routes/orders';
import pickListRoute from './routes/pickList';
import authRoute from './routes/auth';
import alertsRoute from './routes/alerts';
import auditLogsRoute from './routes/auditLogs';

// Public routes
app.route('/webhooks', webhookRoute);
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth routes (no JWT required — not under /api/*)
app.route('/auth', authRoute);

// Auth middleware for /api/* routes only
app.use('/api/*', jwtAuth);

app.route('/api/products', productsRoute);
app.route('/api/inventory', inventoryRoute);
app.route('/api/locations', locationsRoute);
app.route('/api/orders', ordersRoute);
app.route('/api/pick-list', pickListRoute);
app.route('/api/alerts', alertsRoute);
app.route('/api/audit-logs', auditLogsRoute);

app.onError(errorHandler);
const port = parseInt(process.env.PORT || '3002');
AppDataSource.initialize().then(async () => {
  console.log('Database connected');
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port });
  console.log(`Server running on http://localhost:${port}`);
}).catch((err) => { console.error('Failed to start:', err); process.exit(1); });
