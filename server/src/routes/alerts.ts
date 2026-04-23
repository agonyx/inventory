import { Hono } from 'hono';
import { getLowStockAlerts } from '../services/alerts';

const app = new Hono();

app.get('/', async (c) => {
  const alerts = await getLowStockAlerts();
  return c.json(alerts);
});

export default app;
