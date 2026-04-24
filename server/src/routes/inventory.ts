import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { InventoryLevel } from '../entities/InventoryLevel';
import { StockAdjustment, AdjustmentReason } from '../entities/StockAdjustment';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';

const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const adjustmentRepo = () => AppDataSource.getRepository(StockAdjustment);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const adjustSchema = z.object({
  quantityChange: z.number().int(),
  reason: z.nativeEnum(AdjustmentReason).default(AdjustmentReason.MANUAL),
  notes: z.string().optional(),
  adjustedBy: z.string().optional(),
});

const app = new Hono();
app.onError(errorHandler);

// GET /api/inventory — list all inventory levels with variant and location
app.get('/', async (c) => {
  const levels = await inventoryRepo().find({
    relations: ['variant', 'variant.product', 'location'],
    order: { createdAt: 'DESC' },
  });
  return c.json(levels);
});

// POST /api/inventory/:id/adjust — adjust stock quantity
app.post('/:id/adjust', zValidator('json', adjustSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const level = await inventoryRepo().findOne({
    where: { id },
    relations: ['variant'],
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
  await inventoryRepo().save(level);

  const adjustment = adjustmentRepo().create({
    inventoryLevelId: id,
    quantityChange: data.quantityChange,
    previousQuantity: previousQty,
    newQuantity: newQty,
    reason: data.reason,
    notes: data.notes || null,
    adjustedBy: data.adjustedBy || null,
  });
  await adjustmentRepo().save(adjustment);

  const audit = auditRepo().create({
    action: AuditAction.ADJUST_STOCK,
    entityType: 'inventory',
    entityId: id,
    oldValues: { quantity: previousQty },
    newValues: { quantity: newQty },
    performedBy: data.adjustedBy || null,
    notes: `Stock adjusted: ${data.quantityChange > 0 ? '+' : ''}${data.quantityChange}. Reason: ${data.reason}`,
  });
  await auditRepo().save(audit);

  // Reload with relations
  const updated = await inventoryRepo().findOne({
    where: { id },
    relations: ['variant', 'variant.product', 'location'],
  });

  return c.json({ inventoryLevel: updated, adjustment });
});

export default app;
