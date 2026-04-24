import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';

const orderRepo = () => AppDataSource.getRepository(Order);
const auditRepo = () => AppDataSource.getRepository(AuditLog);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const status = c.req.query('status');
  const where = status ? { status: status as OrderStatus } : {};
  const orders = await orderRepo().find({
    where,
    relations: ['items', 'items.variant', 'items.variant.product'],
    order: { createdAt: 'DESC' },
  });
  return c.json(orders);
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
