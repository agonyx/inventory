import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppDataSource } from './data-source';
const app = new Hono();
app.use(cors());

import productsRoute from './routes/products';
import inventoryRoute from './routes/inventory';
import locationsRoute from './routes/locations';

app.route('/api/products', productsRoute);
app.route('/api/inventory', inventoryRoute);
app.route('/api/locations', locationsRoute);

import webhookRoute from './routes/webhooks';
import ordersRoute from './routes/orders';

app.route('/webhooks', webhookRoute);
app.route('/api/orders', ordersRoute);

import pickListRoute from './routes/pickList';
import alertsRoute from './routes/alerts';
app.route('/api/pick-list', pickListRoute);
app.route('/api/alerts', alertsRoute);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.onError((err, c) => {
  console.error('Request error:', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  const status = message.includes('already exists') ? 409 : message.includes('not found') ? 404 : message.includes('Cannot reduce') ? 400 : 500;
  return c.json({ error: message }, status as 400 | 404 | 409 | 500);
});
const port = parseInt(process.env.PORT || '3002');
AppDataSource.initialize().then(() => {
  console.log('Database connected');
  Bun.serve({ fetch: app.fetch, port });
  console.log(`Server running on http://localhost:${port}`);
}).catch((err) => { console.error('Failed to start:', err); process.exit(1); });
