import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { In, Like, Not, IsNull } from 'typeorm';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AppDataSource } from '../data-source';
import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';
import { InventoryLevel } from '../entities/InventoryLevel';
import { Location } from '../entities/Location';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse } from '../utils/pagination';
import { parseSort } from '../utils/sort';
import { exportToCsv, getCsvFilename } from '../utils/csv-export';

const productRepo = () => AppDataSource.getRepository(Product);
const variantRepo = () => AppDataSource.getRepository(ProductVariant);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const locationRepo = () => AppDataSource.getRepository(Location);

const ALLOWED_SORT_COLUMNS = ['name', 'sku', 'category', 'price', 'createdAt'];

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

if (!existsSync(UPLOADS_DIR)) {
  mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});
}

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(0),
  supplierId: z.string().uuid().optional().nullable(),
  variants: z.array(z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
});

const app = new Hono();
app.onError(errorHandler);

function computeTotalStock(product: Product): number {
  if (!product.variants || product.variants.length === 0) return 0;
  return product.variants.reduce((sum, v) => {
    const invSum = (v.inventoryLevels || []).reduce((s, l) => s + (l.quantity ?? 0), 0);
    return sum + invSum;
  }, 0);
}

// GET /api/products — list all products with variants, inventory, pagination, filtering, sorting
app.get('/', async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const { sortBy, sortDir } = parseSort(c.req.query(), ALLOWED_SORT_COLUMNS);
  const search = c.req.query('search');
  const barcode = c.req.query('barcode');
  const category = c.req.query('category');
  const stockStatus = c.req.query('stockStatus');

  const where: any = {};

  if (search) {
    where.name = Like(`%${search}%`);
    where.sku = Like(`%${search}%`);
  }
  if (category) {
    where.category = category;
  }

  // Fetch a larger set to allow for JS-side stockStatus filtering
  // We'll fetch without pagination first if stockStatus is requested,
  // or use DB pagination when no stockStatus filter
  const relations = ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'];

  let products: Product[];
  let total: number;

  // If barcode search is provided, find matching variant product IDs first
  let barcodeProductIds: string[] | null = null;
  if (barcode) {
    const matchingVariants = await variantRepo().find({
      where: { barcode: Like(`%${barcode}%`) },
      select: ['productId'],
    });
    const uniqueIds = [...new Set(matchingVariants.map((v) => v.productId))];
    if (uniqueIds.length > 0) {
      barcodeProductIds = uniqueIds;
    } else {
      // No variants match the barcode — return empty result
      return c.json({
        data: [],
        pagination: buildPaginationResponse(page, limit, 0),
      });
    }
  }

  if (stockStatus) {
    // Need to load all matching products to filter by computed stock
    const effectiveWhere = barcodeProductIds
      ? { ...where, id: In(barcodeProductIds) }
      : where;
    const allResults = await productRepo().find({
      where: effectiveWhere,
      relations,
      select: ['id', 'name', 'sku', 'category', 'price', 'lowStockThreshold', 'supplierId', 'images', 'createdAt', 'updatedAt'],
      order: { [sortBy]: sortDir },
    });

    const filtered = allResults.filter((p) => {
      const totalStock = computeTotalStock(p);
      const threshold = p.lowStockThreshold ?? 0;
      switch (stockStatus) {
        case 'in_stock':
          return totalStock > threshold;
        case 'low_stock':
          return totalStock > 0 && totalStock <= threshold;
        case 'out_of_stock':
          return totalStock === 0;
        default:
          return true;
      }
    });

    total = filtered.length;
    products = filtered.slice((page - 1) * limit, page * limit);
  } else {
    // Build TypeORM where with OR for search
    let findWhere: any;
    if (search) {
      findWhere = [
        { ...where, name: Like(`%${search}%`) },
        { ...where, sku: Like(`%${search}%`) },
      ];
      if (category) {
        findWhere = [
          { name: Like(`%${search}%`), category },
          { sku: Like(`%${search}%`), category },
        ];
      }
    } else {
      findWhere = where;
    }

    // If barcode search is active, narrow results to matching product IDs
    if (barcodeProductIds) {
      if (Array.isArray(findWhere)) {
        // Wrap each OR condition with the barcode ID constraint
        findWhere = findWhere.map((cond: any) => ({
          ...cond,
          id: In(barcodeProductIds),
        }));
      } else {
        findWhere = { ...findWhere, id: In(barcodeProductIds) };
      }
    }

    const [results, count] = await productRepo().findAndCount({
      where: findWhere,
      relations,
      select: ['id', 'name', 'sku', 'category', 'price', 'lowStockThreshold', 'supplierId', 'images', 'createdAt', 'updatedAt'],
      order: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit,
    });

    products = results;
    total = count;
  }

  return c.json({
    data: products,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

// GET /api/products/export — CSV export
app.get('/export', async (c) => {
  const query = c.req.query();
  const { sortBy, sortDir } = parseSort(query, ALLOWED_SORT_COLUMNS);
  const search = query.search;
  const category = query.category;
  const stockStatus = query.stockStatus;

  const relations = ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'];

  let findWhere: any;
  if (search) {
    findWhere = category
      ? [
          { name: Like(`%${search}%`), category },
          { sku: Like(`%${search}%`), category },
        ]
      : [
          { name: Like(`%${search}%`) },
          { sku: Like(`%${search}%`) },
        ];
  } else {
    findWhere = category ? { category } : {};
  }

  const [products] = await productRepo().findAndCount({
    where: findWhere,
    relations,
    order: { [sortBy]: sortDir },
  });

  let filtered = products;
  if (stockStatus) {
    filtered = products.filter((p) => {
      const totalStock = computeTotalStock(p);
      const threshold = p.lowStockThreshold ?? 0;
      switch (stockStatus) {
        case 'in_stock': return totalStock > threshold;
        case 'low_stock': return totalStock > 0 && totalStock <= threshold;
        case 'out_of_stock': return totalStock === 0;
        default: return true;
      }
    });
  }

  const headers = ['name', 'sku', 'category', 'price', 'totalStock', 'lowStockThreshold', 'createdAt'];
  const rows = filtered.map((p) => ({
    name: p.name,
    sku: p.sku,
    category: p.category || '',
    price: p.price,
    totalStock: computeTotalStock(p),
    lowStockThreshold: p.lowStockThreshold,
    createdAt: p.createdAt?.toISOString(),
  }));

  const csv = exportToCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${getCsvFilename('products')}"`,
    },
  });
});

// GET /api/products/:id
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const product = await productRepo().findOne({
    where: { id },
    relations: ['variants', 'variants.inventoryLevels', 'variants.inventoryLevels.location'],
  });
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
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
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
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
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
  if (product.variants.length > 0) {
    const variantIds = product.variants.map((v) => v.id);
    await inventoryRepo().delete({ variantId: In(variantIds) });
  }
  const result = await productRepo().delete(id);
  if (result.affected === 0) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
  return c.json({ success: true });
});

const variantCreateSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional(),
});

const variantUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  description: z.string().optional(),
});

// POST /api/products/:id/variants — add variant to existing product
app.post('/:id/variants', zValidator('json', variantCreateSchema), async (c) => {
  const productId = c.req.param('id');
  const data = c.req.valid('json');

  const product = await productRepo().findOne({ where: { id: productId } });
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');

  const variant = variantRepo().create({ ...data, productId });
  await variantRepo().save(variant);

  // Auto-create inventory levels at all existing locations
  const locations = await locationRepo().find();
  for (const loc of locations) {
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

  // Reload with relations
  const saved = await variantRepo().findOne({
    where: { id: variant.id },
    relations: ['inventoryLevels', 'inventoryLevels.location'],
  });
  return c.json(saved, 201);
});

// PATCH /api/products/:productId/variants/:variantId — edit variant
app.patch('/:productId/variants/:variantId', zValidator('json', variantUpdateSchema), async (c) => {
  const productId = c.req.param('productId');
  const variantId = c.req.param('variantId');
  const data = c.req.valid('json');

  const variant = await variantRepo().findOne({ where: { id: variantId, productId } });
  if (!variant) throw new AppError(404, ErrorCode.NOT_FOUND, 'Variant not found');

  variantRepo().merge(variant, data);
  await variantRepo().save(variant);

  const saved = await variantRepo().findOne({
    where: { id: variant.id },
    relations: ['inventoryLevels', 'inventoryLevels.location'],
  });
  return c.json(saved);
});

// DELETE /api/products/:productId/variants/:variantId — remove variant
app.delete('/:productId/variants/:variantId', async (c) => {
  const productId = c.req.param('productId');
  const variantId = c.req.param('variantId');

  const variant = await variantRepo().findOne({ where: { id: variantId, productId } });
  if (!variant) throw new AppError(404, ErrorCode.NOT_FOUND, 'Variant not found');

  // Check inventory — prevent deletion if any levels have stock
  const levels = await inventoryRepo().find({ where: { variantId } });
  const activeLevel = levels.find(
    (l) => l.quantity > 0 || l.reservedQuantity > 0,
  );
  if (activeLevel) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      'Cannot delete variant with active inventory (quantity or reserved quantity > 0)',
    );
  }

  // Delete inventory levels for this variant
  await inventoryRepo().delete({ variantId });
  // Delete the variant
  await variantRepo().delete(variantId);

  return c.json({ success: true });
});

// GET /api/products/:id/images
app.get('/:id/images', async (c) => {
  const id = c.req.param('id');
  const product = await productRepo().findOne({ where: { id } });
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');
  return c.json({ images: product.images || [] });
});

// POST /api/products/:id/images
app.post('/:id/images', async (c) => {
  const id = c.req.param('id');
  const product = await productRepo().findOne({ where: { id } });
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'No file uploaded');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'File size exceeds 5MB limit');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only image files (jpg, png, webp, gif) are allowed');
  }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const filename = `product-${id}-${Date.now()}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(arrayBuffer));

  const imagePath = `/uploads/${filename}`;
  product.images = [...(product.images || []), imagePath];
  await productRepo().save(product);

  return c.json({ success: true, image: imagePath }, 201);
});

// DELETE /api/products/:id/images/:index
app.delete('/:id/images/:index', async (c) => {
  const id = c.req.param('id');
  const index = parseInt(c.req.param('index'), 10);

  const product = await productRepo().findOne({ where: { id } });
  if (!product) throw new AppError(404, ErrorCode.NOT_FOUND, 'Product not found');

  const images = product.images || [];
  if (isNaN(index) || index < 0 || index >= images.length) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid image index');
  }

  const imagePath = images[index];
  const filename = path.basename(imagePath);
  const filepath = path.join(UPLOADS_DIR, filename);

  try {
    await unlink(filepath);
  } catch {}

  images.splice(index, 1);
  product.images = images;
  await productRepo().save(product);

  return c.json({ success: true });
});

export default app;
