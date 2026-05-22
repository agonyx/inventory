import { Hono } from 'hono';
import { getLowStockAlerts } from '../services/alerts';
import { errorHandler } from '../middleware/error-handler';

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const alerts = await getLowStockAlerts();
  return c.json(alerts);
});

export default app;
