import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';
import { AuditLog, AuditAction } from '../entities/AuditLog';

const orderRepo = () => AppDataSource.getRepository(Order);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const app = new Hono();

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
  if (!order) return c.json({ error: 'Not found' }, 404);
  return c.json(order);
});

app.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');
  const order = await orderRepo().findOne({
    where: { id },
    relations: ['items', 'items.variant'],
  });
  if (!order) return c.json({ error: 'Not found' }, 404);

  const oldStatus = order.status;
  order.status = status;
  await orderRepo().save(order);

  // If packing/shipping, release reserved stock
  if (status === OrderStatus.PACKED || status === OrderStatus.SHIPPED) {
    for (const item of order.items) {
      if (!item.variant) continue;
      // Find inventory level for this variant - use the first one
      const { InventoryLevel } = await import('../entities/InventoryLevel');
      const invRepo = AppDataSource.getRepository(InventoryLevel);
      const level = await invRepo.findOne({ where: { variantId: item.variant.id } });
      if (level) {
        level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
        if (status === OrderStatus.SHIPPED) {
          level.quantity = Math.max(0, level.quantity - item.quantity);
        }
        await invRepo.save(level);
      }
    }
  }

  // If cancelled, release all reserved stock
  if (status === OrderStatus.CANCELLED) {
    for (const item of order.items) {
      if (!item.variant) continue;
      const { InventoryLevel } = await import('../entities/InventoryLevel');
      const invRepo = AppDataSource.getRepository(InventoryLevel);
      const level = await invRepo.findOne({ where: { variantId: item.variant.id } });
      if (level) {
        level.reservedQuantity = Math.max(0, level.reservedQuantity - item.quantity);
        level.quantity += item.quantity; // return reserved to available
        await invRepo.save(level);
      }
    }
  }

  // Audit log
  const audit = auditRepo().create({
    action: AuditAction.UPDATE_ORDER_STATUS,
    entityType: 'order',
    entityId: id,
    oldValues: { status: oldStatus },
    newValues: { status },
    notes: `Order status changed from ${oldStatus} to ${status}`,
  });
  await auditRepo().save(audit);

  // Reload
  const updated = await orderRepo().findOne({
    where: { id },
    relations: ['items', 'items.variant', 'items.variant.product'],
  });
  return c.json(updated);
});

export default app;
