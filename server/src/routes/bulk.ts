import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { In, Not } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';
import { InventoryLevel } from '../entities/InventoryLevel';
import { Order, OrderStatus } from '../entities/Order';
import { StockAdjustment, AdjustmentReason } from '../entities/StockAdjustment';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';

const productRepo = () => AppDataSource.getRepository(Product);
const variantRepo = () => AppDataSource.getRepository(ProductVariant);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);
const orderRepo = () => AppDataSource.getRepository(Order);
const adjustmentRepo = () => AppDataSource.getRepository(StockAdjustment);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.nativeEnum(OrderStatus),
});

const VALID_BULK_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [],
  [OrderStatus.CANCELLED]: [],
};

const bulkAdjustItemSchema = z.object({
  inventoryLevelId: z.string().uuid(),
  quantityChange: z.number().int(),
  reason: z.nativeEnum(AdjustmentReason),
  note: z.string().optional(),
});

const bulkAdjustSchema = z.object({
  adjustments: z.array(bulkAdjustItemSchema).min(1).max(100),
});

const app = new Hono();
app.onError(errorHandler);

// POST /api/products/bulk-delete
app.post('/products/bulk-delete', zValidator('json', bulkDeleteSchema), async (c) => {
  const { ids } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const products = await manager.find(Product, {
      where: { id: In(ids) },
      relations: ['variants'],
    });

    if (products.length === 0) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'No matching products found');
    }

    // Collect all variant IDs
    const variantIds: string[] = [];
    for (const product of products) {
      for (const variant of product.variants) {
        variantIds.push(variant.id);
      }
    }

    // Check for active stock before deleting
    if (variantIds.length > 0) {
      const activeLevels = await manager.find(InventoryLevel, {
        where: variantIds.map((vid) => ({ variantId: vid, quantity: Not(0) })),
      });
      if (activeLevels.length > 0) {
        throw new AppError(409, ErrorCode.CONFLICT,
          `Cannot delete: ${activeLevels.length} inventory level(s) still have stock. Zero out stock first.`);
      }
    }

    // Delete inventory levels for all variants
    if (variantIds.length > 0) {
      await manager.delete(InventoryLevel, { variantId: In(variantIds) });
    }

    // Delete the products (variants cascade)
    await manager.delete(Product, { id: In(products.map((p) => p.id)) });

    // Create audit log entries
    for (const product of products) {
      const audit = manager.create(AuditLog, {
        action: AuditAction.DELETE,
        entityType: 'product',
        entityId: product.id,
        oldValues: { name: product.name, sku: product.sku },
        notes: `Bulk deleted product: ${product.name}`,
      });
      await manager.save(audit);
    }

    return products.length;
  });

  return c.json({ deleted: result });
});

// POST /api/orders/bulk-status
app.post('/orders/bulk-status', zValidator('json', bulkStatusSchema), async (c) => {
  const { ids, status } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const orders = await manager.find(Order, {
      where: { id: In(ids) },
      relations: ['items', 'items.variant'],
    });

    if (orders.length === 0) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'No matching orders found');
    }

    let updatedCount = 0;

    for (const order of orders) {
      const oldStatus = order.status;

      // Skip orders already in the target status
      if (oldStatus === status) continue;

      // Validate transition
      if (!VALID_BULK_TRANSITIONS[oldStatus]?.includes(status)) continue;

      order.status = status;
      await manager.save(order);

      for (const item of order.items) {
        if (!item.variant) continue;

        const level = await manager.findOne(InventoryLevel, {
          where: { variantId: item.variant.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!level) continue;

        if (oldStatus === OrderStatus.PENDING && status === OrderStatus.CANCELLED) {
          level.reservedQuantity -= item.quantity;
        } else if (oldStatus === OrderStatus.CONFIRMED && status === OrderStatus.PACKED) {
          level.reservedQuantity -= item.quantity;
        } else if (oldStatus === OrderStatus.CONFIRMED && status === OrderStatus.CANCELLED) {
          level.reservedQuantity -= item.quantity;
        } else if (oldStatus === OrderStatus.PACKED && status === OrderStatus.SHIPPED) {
          level.quantity -= item.quantity;
        }
        await manager.save(level);
      }

      const audit = manager.create(AuditLog, {
        action: AuditAction.UPDATE_ORDER_STATUS,
        entityType: 'order',
        entityId: order.id,
        oldValues: { status: oldStatus },
        newValues: { status },
        notes: `Bulk order status changed from ${oldStatus} to ${status}`,
      });
      await manager.save(audit);

      updatedCount++;
    }

    return updatedCount;
  });

  return c.json({ updated: result });
});

// POST /api/inventory/bulk-adjust
app.post('/inventory/bulk-adjust', zValidator('json', bulkAdjustSchema), async (c) => {
  const { adjustments } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    let adjustedCount = 0;

    for (const adj of adjustments) {
      const level = await manager.findOne(InventoryLevel, {
        where: { id: adj.inventoryLevelId },
        relations: ['variant'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!level) continue;

      const previousQty = level.quantity;
      const newQty = previousQty + adj.quantityChange;

      if (newQty < 0) continue;
      if (newQty < level.reservedQuantity) continue;

      level.quantity = newQty;
      await manager.save(level);

      const adjustment = manager.create(StockAdjustment, {
        inventoryLevelId: adj.inventoryLevelId,
        quantityChange: adj.quantityChange,
        previousQuantity: previousQty,
        newQuantity: newQty,
        reason: adj.reason,
        notes: adj.note || null,
      });
      await manager.save(adjustment);

      const audit = manager.create(AuditLog, {
        action: AuditAction.ADJUST_STOCK,
        entityType: 'inventory',
        entityId: adj.inventoryLevelId,
        oldValues: { quantity: previousQty },
        newValues: { quantity: newQty },
        notes: `Bulk stock adjusted: ${adj.quantityChange > 0 ? '+' : ''}${adj.quantityChange}. Reason: ${adj.reason}`,
      });
      await manager.save(audit);

      adjustedCount++;
    }

    return adjustedCount;
  });

  return c.json({ adjusted: result });
});

export default app;
