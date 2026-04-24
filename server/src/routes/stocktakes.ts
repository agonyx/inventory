import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Stocktake, StocktakeStatus } from '../entities/Stocktake';
import { StocktakeItem } from '../entities/StocktakeItem';
import { InventoryLevel } from '../entities/InventoryLevel';
import { StockAdjustment, AdjustmentReason } from '../entities/StockAdjustment';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';
import { parseSort } from '../utils/sort';

const stocktakeRepo = () => AppDataSource.getRepository(Stocktake);
const stocktakeItemRepo = () => AppDataSource.getRepository(StocktakeItem);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const adjustmentRepo = () => AppDataSource.getRepository(StockAdjustment);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const createStocktakeSchema = z.object({
  locationId: z.string().uuid(),
  notes: z.string().optional(),
});

const updateItemSchema = z.object({
  countedQuantity: z.number().int().min(0),
  notes: z.string().optional(),
});

const statusSchema = z.object({
  status: z.nativeEnum(StocktakeStatus),
});

const STOCKTAKE_SORT_COLUMNS = ['createdAt', 'status', 'updatedAt'];

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort(query, STOCKTAKE_SORT_COLUMNS);

  const conditions: Record<string, any> = {};
  if (query.status) conditions.status = query.status;
  if (query.locationId) conditions.locationId = query.locationId;

  const [stocktakes, total] = await stocktakeRepo().findAndCount({
    where: Object.keys(conditions).length > 0 ? conditions : {},
    relations: ['location', 'items', 'items.variant', 'items.variant.product'],
    order: { [sortBy]: sortDir },
    ...paginate(page, limit),
  });

  return c.json({
    data: stocktakes,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

app.post('/', zValidator('json', createStocktakeSchema), async (c) => {
  const body = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const stocktake = manager.create(Stocktake, {
      locationId: body.locationId,
      notes: body.notes || null,
      status: StocktakeStatus.DRAFT,
    });
    await manager.save(stocktake);

    // Get current inventory for this location
    const levels = await manager.find(InventoryLevel, {
      where: { locationId: body.locationId },
    });

    const items = levels.map((level) =>
      manager.create(StocktakeItem, {
        stocktakeId: stocktake.id,
        variantId: level.variantId,
        systemQuantity: level.quantity,
        countedQuantity: null,
        discrepancy: null,
      })
    );
    await manager.save(items);

    stocktake.items = items;
    return stocktake;
  });

  return c.json(result, 201);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const stocktake = await stocktakeRepo().findOne({
    where: { id },
    relations: ['location', 'items', 'items.variant', 'items.variant.product'],
  });
  if (!stocktake) throw new AppError(404, ErrorCode.NOT_FOUND, 'Stocktake not found');
  return c.json(stocktake);
});

app.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const stocktake = await manager.findOne(Stocktake, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!stocktake) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Stocktake not found');
    }

    const oldStatus = stocktake.status;

    // Validate transitions
    if (status === StocktakeStatus.IN_PROGRESS && stocktake.status !== StocktakeStatus.DRAFT) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only draft stocktakes can be started');
    }
    if (status === StocktakeStatus.COMPLETED && stocktake.status !== StocktakeStatus.IN_PROGRESS) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only in-progress stocktakes can be completed');
    }

    stocktake.status = status;

    if (status === StocktakeStatus.COMPLETED) {
      stocktake.completedAt = new Date();

      for (const item of stocktake.items) {
        if (item.countedQuantity === null) continue;

        const discrepancy = item.countedQuantity - item.systemQuantity;
        item.discrepancy = discrepancy;

        // Only adjust if there is a discrepancy
        if (discrepancy !== 0) {
          const level = await manager.findOne(InventoryLevel, {
            where: { variantId: item.variantId, locationId: stocktake.locationId },
            lock: { mode: 'pessimistic_write' },
          });
          if (level) {
            level.quantity = item.countedQuantity;
            await manager.save(level);

            // Create stock adjustment record
            const adjustment = manager.create(StockAdjustment, {
              inventoryLevelId: level.id,
              quantityChange: discrepancy,
              previousQuantity: item.systemQuantity,
              newQuantity: item.countedQuantity,
              reason: AdjustmentReason.STOCKTAKE,
              notes: `Stocktake ${id}: system=${item.systemQuantity}, counted=${item.countedQuantity}`,
            });
            await manager.save(adjustment);

            // Audit log
            const audit = manager.create(AuditLog, {
              action: AuditAction.ADJUST_STOCK,
              entityType: 'inventory',
              entityId: level.id,
              oldValues: { quantity: item.systemQuantity },
              newValues: { quantity: item.countedQuantity },
              notes: `Stocktake ${id}: adjusted ${item.variantId} by ${discrepancy} (system: ${item.systemQuantity}, counted: ${item.countedQuantity})`,
            });
            await manager.save(audit);
          }
        }
        await manager.save(item);
      }

      // Overall audit log
      const totalDiscrepancies = stocktake.items.filter((i) => i.discrepancy !== null && i.discrepancy !== 0).length;
      const audit = manager.create(AuditLog, {
        action: AuditAction.STOCKTAKE_COMPLETED,
        entityType: 'stocktake',
        entityId: id,
        oldValues: { status: oldStatus },
        newValues: { status, totalDiscrepancies },
        notes: `Stocktake ${id} completed for location ${stocktake.locationId} with ${totalDiscrepancies} discrepancies`,
      });
      await manager.save(audit);
    }

    await manager.save(stocktake);

    return await manager.findOne(Stocktake, {
      where: { id },
      relations: ['location', 'items', 'items.variant', 'items.variant.product'],
    });
  });

  return c.json(result);
});

app.patch('/:id/items/:itemId', zValidator('json', updateItemSchema), async (c) => {
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = c.req.valid('json');

  const stocktake = await stocktakeRepo().findOne({ where: { id } });
  if (!stocktake) throw new AppError(404, ErrorCode.NOT_FOUND, 'Stocktake not found');
  if (stocktake.status !== StocktakeStatus.IN_PROGRESS) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Can only update items on in-progress stocktakes');
  }

  const item = await stocktakeItemRepo().findOne({
    where: { id: itemId, stocktakeId: id },
    relations: ['variant'],
  });
  if (!item) throw new AppError(404, ErrorCode.NOT_FOUND, 'Stocktake item not found');

  item.countedQuantity = body.countedQuantity;
  item.discrepancy = body.countedQuantity - item.systemQuantity;
  item.notes = body.notes || item.notes;
  await stocktakeItemRepo().save(item);

  return c.json(item);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const stocktake = await stocktakeRepo().findOne({ where: { id } });
  if (!stocktake) throw new AppError(404, ErrorCode.NOT_FOUND, 'Stocktake not found');
  if (stocktake.status !== StocktakeStatus.DRAFT) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only draft stocktakes can be deleted');
  }
  await stocktakeRepo().remove(stocktake);
  return c.json({ message: 'Stocktake deleted' });
});

export default app;
