import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Location } from '../entities/Location';

const locationRepo = () => AppDataSource.getRepository(Location);

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  address: z.string().optional(),
});

const app = new Hono();

app.get('/', async (c) => {
  const locations = await locationRepo().find({ order: { name: 'ASC' } });
  return c.json(locations);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json');
  const location = locationRepo().create(data);
  await locationRepo().save(location);
  return c.json(location, 201);
});

export default app;
