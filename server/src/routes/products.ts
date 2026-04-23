import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';

const productRepo = () => AppDataSource.getRepository(Product);
const variantRepo = () => AppDataSource.getRepository(ProductVariant);

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(0),
  variants: z.array(z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
});

const app = new Hono();

// GET /api/products — list all products with variants and inventory
app.get('/', async (c) => {
  const products = await productRepo().find({
    relations: ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'],
    order: { createdAt: 'DESC' },
  });
  return c.json(products);
});

// GET /api/products/:id
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const product = await productRepo().findOne({
    where: { id },
    relations: ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'],
  });
  if (!product) return c.json({ error: 'Not found' }, 404);
  return c.json(product);
});

// POST /api/products — create product with optional variants
app.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json');
  const product = productRepo().create(data);
  if (data.variants && data.variants.length > 0) {
    product.variants = data.variants.map((v) => variantRepo().create(v));
  }
  await productRepo().save(product);
  // Reload with relations
  const saved = await productRepo().findOne({
    where: { id: product.id },
    relations: ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'],
  });
  return c.json(saved, 201);
});

// PATCH /api/products/:id
app.patch('/:id', zValidator('json', createSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const product = await productRepo().findOne({ where: { id } });
  if (!product) return c.json({ error: 'Not found' }, 404);
  productRepo().merge(product, data);
  await productRepo().save(product);
  const saved = await productRepo().findOne({
    where: { id },
    relations: ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'],
  });
  return c.json(saved);
});

// DELETE /api/products/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await productRepo().delete(id);
  if (result.affected === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

export default app;
