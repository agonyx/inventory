import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';
import { InventoryLevel } from '../entities/InventoryLevel';
import { Location } from '../entities/Location';

const productRepo = () => AppDataSource.getRepository(Product);
const variantRepo = () => AppDataSource.getRepository(ProductVariant);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const locationRepo = () => AppDataSource.getRepository(Location);

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
  // Save product first to get an ID, then create variants with explicit productId
  const rawVariants = data.variants || [];
  const product = productRepo().create(data);
  (product as any).variants = [];
  await productRepo().save(product);

  for (const v of rawVariants) {
    const variant = variantRepo().create({ ...v, productId: product.id });
    await variantRepo().save(variant);
  }

  // Auto-create inventory levels for each variant at all existing locations
  const savedVariants = rawVariants.length > 0
    ? await variantRepo().findBy({ productId: product.id })
    : [];
  if (savedVariants.length > 0) {
    const locations = await locationRepo().find();
    for (const variant of savedVariants) {
      for (const loc of locations) {
        // Check if inventory level already exists
        const existing = await inventoryRepo().findOne({
          where: { variantId: variant.id, locationId: loc.id },
        });
        if (!existing) {
          const level = inventoryRepo().create({
            variantId: variant.id,
            locationId: loc.id,
            quantity: 0,
            reservedQuantity: 0,
          });
          await inventoryRepo().save(level);
        }
      }
    }
  }

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
  const product = await productRepo().findOne({
    where: { id },
    relations: ['variants'],
  });
  if (!product) return c.json({ error: 'Not found' }, 404);
  if (product.variants.length > 0) {
    const variantIds = product.variants.map((v) => v.id);
    await inventoryRepo().delete({ variantId: In(variantIds) });
  }
  const result = await productRepo().delete(id);
  if (result.affected === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

export default app;
