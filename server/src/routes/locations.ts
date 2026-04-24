import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Location } from '../entities/Location';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse } from '../utils/pagination';
import { parseSort } from '../utils/sort';

const locationRepo = () => AppDataSource.getRepository(Location);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  address: z.string().optional(),
});

const LOCATION_SORT_COLUMNS = ['name', 'type', 'createdAt'];

const app = new Hono();
app.onError(errorHandler);

// GET /api/locations — list locations with pagination, sorting, variant count
app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort({ ...query, sortBy: query.sortBy || 'name' }, LOCATION_SORT_COLUMNS);

  const [locations, total] = await locationRepo().findAndCount({
    order: { [sortBy]: sortDir },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Get variant count per location (distinct variants with inventory at each location)
  const variantCounts = await inventoryRepo()
    .createQueryBuilder('il')
    .select('il.locationId', 'locationId')
    .addSelect('COUNT(DISTINCT il.variantId)', 'variantCount')
    .groupBy('il.locationId')
    .getRawMany();

  const countMap = new Map(
    (variantCounts as any[]).map((r) => [r.locationId, parseInt(r.variantCount, 10)]),
  );

  const data = locations.map((loc) => ({
    ...loc,
    variantCount: countMap.get(loc.id) || 0,
  }));

  return c.json({
    data,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

// GET /api/locations/:id
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const location = await locationRepo().findOne({ where: { id } });
  if (!location) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');
  return c.json(location);
});

// POST /api/locations
app.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json');
  const location = locationRepo().create(data);
  await locationRepo().save(location);
  return c.json(location, 201);
});

// PATCH /api/locations/:id
app.patch('/:id', zValidator('json', createSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const location = await locationRepo().findOne({ where: { id } });
  if (!location) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');
  locationRepo().merge(location, data);
  await locationRepo().save(location);
  return c.json(location);
});

// DELETE /api/locations/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await locationRepo().delete(id);
  if (result.affected === 0) throw new AppError(404, ErrorCode.NOT_FOUND, 'Location not found');
  return c.json({ success: true });
});

export default app;
