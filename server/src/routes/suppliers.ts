import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Supplier } from '../entities/Supplier';
import { Product } from '../entities/Product';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse } from '../utils/pagination';
import { parseSort } from '../utils/sort';

const supplierRepo = () => AppDataSource.getRepository(Supplier);
const productRepo = () => AppDataSource.getRepository(Product);

const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

const SUPPLIER_SORT_COLUMNS = ['name', 'createdAt'];

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort({ ...query, sortBy: query.sortBy || 'name' }, SUPPLIER_SORT_COLUMNS);
  const search = query.search;

  const qb = supplierRepo()
    .createQueryBuilder('s')
    .leftJoin('s.products', 'p')
    .select(['s.id', 's.name', 's.contactName', 's.email', 's.phone', 's.address', 's.notes', 's.createdAt', 's.updatedAt'])
    .addSelect('COUNT(DISTINCT p.id)', 'productCount')
    .groupBy('s.id')
    .orderBy(`s.${sortBy}`, sortDir)
    .offset((page - 1) * limit)
    .limit(limit);

  if (search) {
    qb.andWhere('s.name ILIKE :search', { search: `%${search}%` });
  }

  const [suppliers, countResult] = await Promise.all([
    qb.getRawAndEntities(),
    supplierRepo()
      .createQueryBuilder('s')
      .where(search ? 's.name ILIKE :search' : '1=1', search ? { search: `%${search}%` } : {})
      .getCount(),
  ]);

  const countMap = new Map<string, number>();
  (suppliers.raw as any[]).forEach((r) => {
    countMap.set(r.s_id, parseInt(r.productCount, 10) || 0);
  });

  const data = suppliers.entities.map((s) => ({
    ...s,
    productCount: countMap.get(s.id) || 0,
  }));

  return c.json({
    data,
    pagination: buildPaginationResponse(page, limit, countResult),
  });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const supplier = await supplierRepo().findOne({ where: { id } });
  if (!supplier) throw new AppError(404, ErrorCode.NOT_FOUND, 'Supplier not found');
  return c.json(supplier);
});

app.post('/', zValidator('json', createSupplierSchema), async (c) => {
  const data = c.req.valid('json');
  const cleaned = {
    ...data,
    email: data.email || null,
    contactName: data.contactName || null,
    phone: data.phone || null,
    address: data.address || null,
    notes: data.notes || null,
  };
  const supplier = supplierRepo().create(cleaned);
  await supplierRepo().save(supplier);
  return c.json(supplier, 201);
});

app.patch('/:id', zValidator('json', updateSupplierSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const supplier = await supplierRepo().findOne({ where: { id } });
  if (!supplier) throw new AppError(404, ErrorCode.NOT_FOUND, 'Supplier not found');
  const cleaned = { ...data, email: data.email || null };
  supplierRepo().merge(supplier, cleaned);
  await supplierRepo().save(supplier);
  return c.json(supplier);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const supplier = await supplierRepo().findOne({ where: { id } });
  if (!supplier) throw new AppError(404, ErrorCode.NOT_FOUND, 'Supplier not found');

  const productCount = await productRepo().count({ where: { supplierId: id } });
  if (productCount > 0) {
    throw new AppError(409, ErrorCode.CONFLICT, `Cannot delete supplier: ${productCount} product(s) reference this supplier`);
  }

  await supplierRepo().remove(supplier);
  return c.json({ success: true });
});

export default app;
