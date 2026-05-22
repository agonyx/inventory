import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { InventoryLevel } from '../entities/InventoryLevel';
import { StockAdjustment, AdjustmentReason } from '../entities/StockAdjustment';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';
import { parseSort } from '../utils/sort';
import { exportToCsv, getCsvFilename } from '../utils/csv-export';

const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const adjustmentRepo = () => AppDataSource.getRepository(StockAdjustment);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const adjustSchema = z.object({
  quantityChange: z.number().int(),
  reason: z.nativeEnum(AdjustmentReason).default(AdjustmentReason.MANUAL),
  notes: z.string().optional(),
});

const INVENTORY_SORT_COLUMNS = ['quantity', 'reservedQuantity', 'createdAt'];

const app = new Hono();
app.onError(errorHandler);

// GET /api/inventory — list all inventory levels with variant and location
app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort(query, INVENTORY_SORT_COLUMNS);

  const where: Record<string, any> = {};

  if (query.locationId) where.locationId = query.locationId;
  if (query.productId) where.variant = { productId: query.productId };

  if (query.lowStock === 'true' || query.lowStock === '1') {
    const qb = inventoryRepo().createQueryBuilder('il')
      .leftJoinAndSelect('il.variant', 'v')
      .leftJoinAndSelect('v.product', 'p')
      .leftJoinAndSelect('il.location', 'l')
      .where('p.lowStockThreshold IS NOT NULL')
      .andWhere('il.quantity <= p.lowStockThreshold');

    if (query.locationId) {
      qb.andWhere('il.locationId = :locationId', { locationId: query.locationId });
    }
    if (query.productId) {
      qb.andWhere('v.productId = :productId', { productId: query.productId });
    }

    const [levels, total] = await qb
      .orderBy(`il.${sortBy}`, sortDir)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return c.json({
      data: levels,
      pagination: buildPaginationResponse(page, limit, total),
    });
  }

  const [levels, total] = await inventoryRepo().findAndCount({
    where: Object.keys(where).length > 0 ? where : {},
    relations: ['variant', 'variant.product', 'location'],
    order: { [sortBy]: sortDir },
    ...paginate(page, limit),
  });

  return c.json({
    data: levels,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

// GET /api/inventory/export — CSV export
app.get('/export', async (c) => {
  const query = c.req.query();
  const { sortBy, sortDir } = parseSort(query, INVENTORY_SORT_COLUMNS);

  const where: Record<string, any> = {};
  if (query.locationId) where.locationId = query.locationId;
  if (query.productId) where.variant = { productId: query.productId };

  const [levels] = await inventoryRepo().findAndCount({
    where: Object.keys(where).length > 0 ? where : {},
    relations: ['variant', 'variant.product', 'location'],
    order: { [sortBy]: sortDir },
  });

  let filtered = levels;
  if (query.lowStock === 'true' || query.lowStock === '1') {
    filtered = levels.filter(
      (level) => level.variant?.product?.lowStockThreshold != null && level.quantity <= level.variant.product.lowStockThreshold,
    );
  }

  const headers = ['productName', 'variantName', 'variantSku', 'locationName', 'quantity', 'reservedQuantity'];
  const rows = filtered.map((l) => ({
    productName: l.variant?.product?.name || '',
    variantName: l.variant?.name || '',
    variantSku: l.variant?.sku || '',
    locationName: l.location?.name || '',
    quantity: l.quantity,
    reservedQuantity: l.reservedQuantity,
  }));

  const csv = exportToCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${getCsvFilename('inventory')}"`,
    },
  });
});

// POST /api/inventory/:id/adjust — adjust stock quantity
app.post('/:id/adjust', zValidator('json', adjustSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const adjustedBy = c.get('auth')?.userId || null;

  const result = await AppDataSource.transaction(async (manager) => {
    const level = await manager.findOne(InventoryLevel, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!level) throw new AppError(404, ErrorCode.NOT_FOUND, 'Inventory level not found');

    const previousQty = level.quantity;
    const newQty = previousQty + data.quantityChange;

    if (newQty < 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot reduce stock below zero');
    }

    if (newQty < level.reservedQuantity) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot reduce stock below reserved quantity');
    }

    level.quantity = newQty;
    await manager.save(level);

    const adjustmentRepo = manager.getRepository(StockAdjustment);
    const adjustment = adjustmentRepo.create({
      inventoryLevelId: id,
      quantityChange: data.quantityChange,
      previousQuantity: previousQty,
      newQuantity: newQty,
      reason: data.reason,
      notes: data.notes || null,
      adjustedBy,
    });
    await manager.save(adjustment);

    const audit = manager.create(AuditLog, {
      action: AuditAction.ADJUST_STOCK,
      entityType: 'inventory',
      entityId: id,
      oldValues: { quantity: previousQty },
      newValues: { quantity: newQty },
      performedBy: adjustedBy,
      notes: `Stock adjusted: ${data.quantityChange > 0 ? '+' : ''}${data.quantityChange}. Reason: ${data.reason}`,
    });
    await manager.save(audit);

    const updated = await manager.findOne(InventoryLevel, {
      where: { id },
      relations: ['variant', 'variant.product', 'location'],
    });

    return { inventoryLevel: updated, adjustment };
  });

  return c.json(result);
});

export default app;
