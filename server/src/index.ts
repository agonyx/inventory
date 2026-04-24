import 'reflect-metadata';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppDataSource } from './data-source';
const app = new Hono();
app.use(cors({ origin: ['http://localhost:5174', 'http://localhost:5173'] }));

import webhookRoute from './routes/webhooks';
import authMiddleware from './middleware/auth';
import productsRoute from './routes/products';
import inventoryRoute from './routes/inventory';
import locationsRoute from './routes/locations';
import ordersRoute from './routes/orders';
import pickListRoute from './routes/pickList';
import alertsRoute from './routes/alerts';

// Public routes
app.route('/webhooks', webhookRoute);
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth middleware for /api/* routes only
app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token !== process.env.AUTH_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

app.route('/api/products', productsRoute);
app.route('/api/inventory', inventoryRoute);
app.route('/api/locations', locationsRoute);
app.route('/api/orders', ordersRoute);
app.route('/api/pick-list', pickListRoute);
app.route('/api/alerts', alertsRoute);

app.onError((err, c) => {
  console.error('Request error:', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  const status = message.includes('already exists') ? 409 : message.includes('not found') ? 404 : message.includes('Cannot reduce') ? 400 : 500;
  return c.json({ error: message }, status as 400 | 404 | 409 | 500);
});
const port = parseInt(process.env.PORT || '3002');
AppDataSource.initialize().then(async () => {
  console.log('Database connected');
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port });
  console.log(`Server running on http://localhost:${port}`);
}).catch((err) => { console.error('Failed to start:', err); process.exit(1); });
