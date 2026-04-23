import { Hono } from 'hono';
import { generatePickList } from '../services/pickList';

const app = new Hono();

app.get('/', async (c) => {
  const pickList = await generatePickList();
  return c.json(pickList);
});

export default app;
