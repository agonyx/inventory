import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Like } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Return, ReturnStatus } from '../entities/Return';
import { ReturnItem, ReturnItemCondition } from '../entities/ReturnItem';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';
import { parseSort } from '../utils/sort';

const returnRepo = () => AppDataSource.getRepository(Return);
const returnItemRepo = () => AppDataSource.getRepository(ReturnItem);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    condition: z.nativeEnum(ReturnItemCondition).optional(),
  })).min(1, 'At least one item is required'),
});

const RETURN_SORT_COLUMNS = ['createdAt', 'status', 'updatedAt'];

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort(query, RETURN_SORT_COLUMNS);

  const conditions: Record<string, any> = {};
  if (query.status) conditions.status = query.status;
  if (query.orderId) conditions.orderId = query.orderId;

  let where: any;
  if (query.search) {
    const pattern = Like(`%${query.search}%`);
    where = [
      { ...conditions, reason: pattern },
      { ...conditions, notes: pattern },
    ];
  } else {
    where = Object.keys(conditions).length > 0 ? conditions : {};
  }

  const [returns, total] = await returnRepo().findAndCount({
    where,
    relations: ['items', 'items.variant', 'items.variant.product', 'order'],
    order: { [sortBy]: sortDir },
    ...paginate(page, limit),
  });

  return c.json({
    data: returns,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

app.post('/', zValidator('json', createReturnSchema), async (c) => {
  const body = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const order = await manager.findOne('Order', {
      where: { id: body.orderId },
    });
    if (!order) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
    }

    const ret = manager.create(Return, {
      orderId: body.orderId,
      reason: body.reason,
      notes: body.notes || null,
      status: ReturnStatus.REQUESTED,
    });
    await manager.save(ret);

    const items = body.items.map((item) =>
      manager.create(ReturnItem, {
        returnId: ret.id,
        variantId: item.variantId,
        quantity: item.quantity,
        condition: item.condition || ReturnItemCondition.NEW,
      })
    );
    await manager.save(items);

    const audit = manager.create(AuditLog, {
      action: AuditAction.CREATE_RETURN,
      entityType: 'return',
      entityId: ret.id,
      newValues: { orderId: body.orderId, reason: body.reason, itemCount: items.length },
      notes: `Return created for order ${body.orderId}`,
    });
    await manager.save(audit);

    ret.items = items;
    return ret;
  });

  const full = await returnRepo().findOne({
    where: { id: result.id },
    relations: ['items', 'items.variant', 'items.variant.product', 'order'],
  });

  return c.json(full, 201);
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const ret = await returnRepo().findOne({
    where: { id },
    relations: ['items', 'items.variant', 'items.variant.product', 'order'],
  });
  if (!ret) throw new AppError(404, ErrorCode.NOT_FOUND, 'Return not found');
  return c.json(ret);
});

app.patch('/:id/approve', async (c) => {
  const id = c.req.param('id');

  const result = await AppDataSource.transaction(async (manager) => {
    const ret = await manager.findOne(Return, {
      where: { id },
      relations: ['items'],
    });
    if (!ret) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Return not found');
    }
    if (ret.status !== ReturnStatus.REQUESTED) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only requested returns can be approved');
    }

    const oldStatus = ret.status;
    ret.status = ReturnStatus.APPROVED;
    await manager.save(ret);

    const audit = manager.create(AuditLog, {
      action: AuditAction.APPROVE_RETURN,
      entityType: 'return',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status: ReturnStatus.APPROVED },
      notes: `Return ${id} approved`,
    });
    await manager.save(audit);

    return await manager.findOne(Return, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product', 'order'],
    });
  });

  return c.json(result);
});

app.patch('/:id/reject', async (c) => {
  const id = c.req.param('id');

  const result = await AppDataSource.transaction(async (manager) => {
    const ret = await manager.findOne(Return, {
      where: { id },
      relations: ['items'],
    });
    if (!ret) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Return not found');
    }
    if (ret.status !== ReturnStatus.REQUESTED) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only requested returns can be rejected');
    }

    const oldStatus = ret.status;
    ret.status = ReturnStatus.REJECTED;
    await manager.save(ret);

    const audit = manager.create(AuditLog, {
      action: AuditAction.REJECT_RETURN,
      entityType: 'return',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status: ReturnStatus.REJECTED },
      notes: `Return ${id} rejected`,
    });
    await manager.save(audit);

    return await manager.findOne(Return, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product', 'order'],
    });
  });

  return c.json(result);
});

app.patch('/:id/receive', zValidator('json', z.object({ locationId: z.string().uuid() })), async (c) => {
  const id = c.req.param('id');
  const { locationId } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const ret = await manager.findOne(Return, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!ret) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Return not found');
    }
    if (ret.status !== ReturnStatus.APPROVED) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only approved returns can be received');
    }

    const oldStatus = ret.status;
    ret.status = ReturnStatus.RECEIVED;
    await manager.save(ret);

    for (const item of ret.items) {
      if (!item.variantId) continue;

      let invLevel = await manager.findOne(InventoryLevel, {
        where: { variantId: item.variantId, locationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (invLevel) {
        invLevel.quantity += item.quantity;
        await manager.save(invLevel);
      } else {
        invLevel = manager.create(InventoryLevel, {
          variantId: item.variantId,
          locationId,
          quantity: item.quantity,
          reservedQuantity: 0,
        });
        await manager.save(invLevel);
      }

      const audit = manager.create(AuditLog, {
        action: AuditAction.RECEIVE_RETURN,
        entityType: 'return',
        entityId: id,
        oldValues: { status: oldStatus },
        newValues: { status: ReturnStatus.RECEIVED, variantId: item.variantId, quantityAdded: item.quantity },
        notes: `Return received: added ${item.quantity} units of variant ${item.variantId} to inventory`,
      });
      await manager.save(audit);
    }

    return await manager.findOne(Return, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product', 'order'],
    });
  });

  return c.json(result);
});

app.patch('/:id/refund', async (c) => {
  const id = c.req.param('id');

  const result = await AppDataSource.transaction(async (manager) => {
    const ret = await manager.findOne(Return, {
      where: { id },
      relations: ['items'],
    });
    if (!ret) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Return not found');
    }
    if (ret.status !== ReturnStatus.RECEIVED) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only received returns can be refunded');
    }

    const oldStatus = ret.status;
    ret.status = ReturnStatus.REFUNDED;
    await manager.save(ret);

    const audit = manager.create(AuditLog, {
      action: AuditAction.REFUND_RETURN,
      entityType: 'return',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status: ReturnStatus.REFUNDED },
      notes: `Return ${id} refunded`,
    });
    await manager.save(audit);

    return await manager.findOne(Return, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product', 'order'],
    });
  });

  return c.json(result);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const ret = await returnRepo().findOne({ where: { id } });
  if (!ret) throw new AppError(404, ErrorCode.NOT_FOUND, 'Return not found');
  if (ret.status !== ReturnStatus.REQUESTED) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Only requested returns can be deleted');
  }
  await returnRepo().remove(ret);
  return c.json({ message: 'Return deleted' });
});

export default app;
