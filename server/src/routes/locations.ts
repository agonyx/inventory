import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Location } from '../entities/Location';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';

const locationRepo = () => AppDataSource.getRepository(Location);

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  address: z.string().optional(),
});

const app = new Hono();
app.onError(errorHandler);

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

app.patch('/:id', zValidator('json', createSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const location = await locationRepo().findOne({ where: { id } });
  if (!location) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');
  locationRepo().merge(location, data);
  await locationRepo().save(location);
  return c.json(location);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await locationRepo().delete(id);
  if (result.affected === 0) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');
  return c.json({ success: true });
});

export default app;
