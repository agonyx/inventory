import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppDataSource } from './data-source';
const app = new Hono();
app.use(cors());
app.get('/health', (c) => c.json({ status: 'ok' }));
const port = parseInt(process.env.PORT || '3002');
AppDataSource.initialize().then(() => {
  console.log('Database connected');
  Bun.serve({ fetch: app.fetch, port });
  console.log(`Server running on http://localhost:${port}`);
}).catch((err) => { console.error('Failed to start:', err); process.exit(1); });
