import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Like } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Transfer, TransferStatus } from '../entities/Transfer';
import { TransferItem } from '../entities/TransferItem';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';
import { parseSort } from '../utils/sort';

const transferRepo = () => AppDataSource.getRepository(Transfer);
const transferItemRepo = () => AppDataSource.getRepository(TransferItem);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const createTransferSchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, 'At least one item is required'),
});

const statusSchema = z.object({
  status: z.nativeEnum(TransferStatus),
});

const VALID_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  [TransferStatus.DRAFT]: [TransferStatus.IN_TRANSIT, TransferStatus.CANCELLED],
  [TransferStatus.IN_TRANSIT]: [TransferStatus.COMPLETED, TransferStatus.CANCELLED],
  [TransferStatus.COMPLETED]: [],
  [TransferStatus.CANCELLED]: [],
};

const TRANSFER_SORT_COLUMNS = ['createdAt', 'status', 'updatedAt'];

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort(query, TRANSFER_SORT_COLUMNS);

  const conditions: Record<string, any> = {};
  if (query.status) conditions.status = query.status;
  if (query.fromLocationId) conditions.fromLocationId = query.fromLocationId;
  if (query.toLocationId) conditions.toLocationId = query.toLocationId;

  let where: any;
  if (query.search) {
    const pattern = Like(`%${query.search}%`);
    where = [
      { ...conditions, notes: pattern },
      { ...conditions, fromLocationId: pattern },
      { ...conditions, toLocationId: pattern },
    ];
  } else {
    where = Object.keys(conditions).length > 0 ? conditions : {};
  }

  const [transfers, total] = await transferRepo().findAndCount({
    where,
    relations: ['fromLocation', 'toLocation', 'items', 'items.variant', 'items.variant.product'],
    order: { [sortBy]: sortDir },
    ...paginate(page, limit),
  });

  return c.json({
    data: transfers,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

app.post('/', zValidator('json', createTransferSchema), async (c) => {
  const body = c.req.valid('json');

  if (body.fromLocationId === body.toLocationId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Source and destination locations must be different');
  }

  // Validate stock availability for all items
  for (const item of body.items) {
    const level = await inventoryRepo().findOne({
      where: { variantId: item.variantId, locationId: body.fromLocationId },
    });
    const available = level ? level.quantity - level.reservedQuantity : 0;
    if (available < item.quantity) {
      throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK,
        `Insufficient stock at source for variant ${item.variantId}: need ${item.quantity}, available ${available}`);
    }
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const transfer = manager.create(Transfer, {
      fromLocationId: body.fromLocationId,
      toLocationId: body.toLocationId,
      notes: body.notes || null,
      status: TransferStatus.DRAFT,
    });
    await manager.save(transfer);

    const items = body.items.map((item) =>
      manager.create(TransferItem, {
        transferId: transfer.id,
        variantId: item.variantId,
        quantity: item.quantity,
      })
    );
    await manager.save(items);

    transfer.items = items;
    return transfer;
  });

  return c.json(result, 201);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const transfer = await transferRepo().findOne({
    where: { id },
    relations: ['fromLocation', 'toLocation', 'items', 'items.variant', 'items.variant.product'],
  });
  if (!transfer) throw new AppError(404, ErrorCode.NOT_FOUND, 'Transfer not found');
  return c.json(transfer);
});

app.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const transfer = await manager.findOne(Transfer, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!transfer) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Transfer not found');
    }

    const allowed = VALID_TRANSITIONS[transfer.status];
    if (!allowed.includes(status)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR,
        `Invalid transition: ${transfer.status} → ${status}`);
    }

    const oldStatus = transfer.status;
    transfer.status = status;

    if (status === TransferStatus.COMPLETED) {
      transfer.completedAt = new Date();

      for (const item of transfer.items) {
        // Deduct from source
        const sourceLevel = await manager.findOne(InventoryLevel, {
          where: { variantId: item.variantId, locationId: transfer.fromLocationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (sourceLevel) {
          sourceLevel.quantity = Math.max(0, sourceLevel.quantity - item.quantity);
          await manager.save(sourceLevel);
        }

        // Add to destination (create if not exists)
        let destLevel = await manager.findOne(InventoryLevel, {
          where: { variantId: item.variantId, locationId: transfer.toLocationId },
        });
        if (!destLevel) {
          destLevel = manager.create(InventoryLevel, {
            variantId: item.variantId,
            locationId: transfer.toLocationId,
            quantity: 0,
            reservedQuantity: 0,
          });
          await manager.save(destLevel);
        }
        destLevel.quantity += item.quantity;
        await manager.save(destLevel);

        // Audit log
        const audit = manager.create(AuditLog, {
          action: AuditAction.TRANSFER_COMPLETED,
          entityType: 'transfer',
          entityId: transfer.id,
          oldValues: { status: oldStatus },
          newValues: { status, variantId: item.variantId, quantity: item.quantity, fromLocationId: transfer.fromLocationId, toLocationId: transfer.toLocationId },
          notes: `Transferred ${item.quantity} units of variant ${item.variantId} from location ${transfer.fromLocationId} to ${transfer.toLocationId}`,
        });
        await manager.save(audit);
      }
    } else if (status === TransferStatus.CANCELLED) {
      const audit = manager.create(AuditLog, {
        action: AuditAction.TRANSFER_CANCELLED,
        entityType: 'transfer',
        entityId: transfer.id,
        oldValues: { status: oldStatus },
        newValues: { status },
        notes: `Transfer ${id} cancelled`,
      });
      await manager.save(audit);
    }

    await manager.save(transfer);

    return await manager.findOne(Transfer, {
      where: { id },
      relations: ['fromLocation', 'toLocation', 'items', 'items.variant', 'items.variant.product'],
    });
  });

  return c.json(result);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const transfer = await transferRepo().findOne({ where: { id } });
  if (!transfer) throw new AppError(404, ErrorCode.NOT_FOUND, 'Transfer not found');
  if (transfer.status !== TransferStatus.DRAFT) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only draft transfers can be deleted');
  }
  await transferRepo().remove(transfer);
  return c.json({ message: 'Transfer deleted' });
});

export default app;
