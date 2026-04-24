import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';
import { parseSort } from '../utils/sort';
import { exportToCsv, getCsvFilename } from '../utils/csv-export';

const orderRepo = () => AppDataSource.getRepository(Order);
const auditRepo = () => AppDataSource.getRepository(AuditLog);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const ORDER_SORT_COLUMNS = ['createdAt', 'totalAmount', 'customerName'];

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort(query, ORDER_SORT_COLUMNS);

  // Build base conditions (AND)
  const conditions: Record<string, any> = {};

  if (query.status) conditions.status = query.status as OrderStatus;
  if (query.source) conditions.source = query.source;

  // Date range on createdAt
  if (query.from && query.to) {
    conditions.createdAt = Between(new Date(query.from), new Date(query.to));
  } else if (query.from) {
    conditions.createdAt = MoreThanOrEqual(new Date(query.from));
  } else if (query.to) {
    conditions.createdAt = LessThanOrEqual(new Date(query.to));
  }

  // Search with ILIKE (OR across fields)
  let where: any;
  if (query.search) {
    const pattern = Like(`%${query.search}%`);
    where = [
      { ...conditions, externalOrderId: pattern },
      { ...conditions, customerName: pattern },
      { ...conditions, customerEmail: pattern },
    ];
  } else {
    where = Object.keys(conditions).length > 0 ? conditions : {};
  }

  const [orders, total] = await orderRepo().findAndCount({
    where,
    relations: ['items', 'items.variant', 'items.variant.product'],
    order: { [sortBy]: sortDir },
    ...paginate(page, limit),
  });

  return c.json({
    data: orders,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

// GET /api/orders/export — CSV export
app.get('/export', async (c) => {
  const query = c.req.query();
  const { sortBy, sortDir } = parseSort(query, ORDER_SORT_COLUMNS);

  const conditions: Record<string, any> = {};
  if (query.status) conditions.status = query.status as OrderStatus;
  if (query.source) conditions.source = query.source;

  if (query.from && query.to) {
    conditions.createdAt = Between(new Date(query.from), new Date(query.to));
  } else if (query.from) {
    conditions.createdAt = MoreThanOrEqual(new Date(query.from));
  } else if (query.to) {
    conditions.createdAt = LessThanOrEqual(new Date(query.to));
  }

  let where: any;
  if (query.search) {
    const pattern = Like(`%${query.search}%`);
    where = [
      { ...conditions, externalOrderId: pattern },
      { ...conditions, customerName: pattern },
      { ...conditions, customerEmail: pattern },
    ];
  } else {
    where = Object.keys(conditions).length > 0 ? conditions : {};
  }

  const [orders] = await orderRepo().findAndCount({
    where,
    order: { [sortBy]: sortDir },
  });

  const headers = ['externalOrderId', 'status', 'customerName', 'customerEmail', 'totalAmount', 'source', 'createdAt'];
  const rows = orders.map((o) => ({
    externalOrderId: o.externalOrderId,
    status: o.status,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    totalAmount: o.totalAmount,
    source: o.source || '',
    createdAt: o.createdAt?.toISOString(),
  }));

  const csv = exportToCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${getCsvFilename('orders')}"`,
    },
  });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const order = await orderRepo().findOne({
    where: { id },
    relations: ['items', 'items.variant', 'items.variant.product'],
  });
  if (!order) throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
  return c.json(order);
});

app.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!order) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
    }

    const oldStatus = order.status;
    order.status = status;
    await manager.save(order);

    // Handle stock release based on status change
    if (status === OrderStatus.PACKED || status === OrderStatus.SHIPPED || status === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        if (!item.variant) continue;

        // Read inventory level inside transaction with lock
        const level = await manager.findOne(InventoryLevel, {
          where: { variantId: item.variant.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!level) continue;

        if (status === OrderStatus.PACKED) {
          level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
        } else if (status === OrderStatus.SHIPPED) {
          level.quantity = Math.max(0, level.quantity - item.quantity);
          level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
        } else if (status === OrderStatus.CANCELLED) {
          level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
          level.quantity += item.quantity;
        }
        await manager.save(level);
      }
    }

    const audit = manager.create(AuditLog, {
      action: AuditAction.UPDATE_ORDER_STATUS,
      entityType: 'order',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status },
      notes: `Order status changed from ${oldStatus} to ${status}`,
    });
    await manager.save(audit);

    return await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });
  });

  return c.json(result);
});

export default app;
