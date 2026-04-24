import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { InventoryLevel } from '../entities/InventoryLevel';
import { ProductVariant } from '../entities/ProductVariant';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { sendOrderConfirmation } from './email';

export interface WebhookPayload {
  externalOrderId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress?: string;
  totalAmount: number;
  source: string;
  items: {
    sku: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export async function processWebhookOrder(payload: WebhookPayload): Promise<Order> {
  return await AppDataSource.transaction(async (manager) => {
    const existing = await manager.findOne(Order, { where: { externalOrderId: payload.externalOrderId } });
    if (existing) {
      throw new AppError(409, ErrorCode.CONFLICT, `Order ${payload.externalOrderId} already exists`);
    }

    const order = manager.create(Order, {
      externalOrderId: payload.externalOrderId,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      shippingAddress: payload.shippingAddress || null,
      totalAmount: payload.totalAmount,
      source: payload.source,
      status: OrderStatus.PENDING,
    });
    await manager.save(order);

    const orderItems: OrderItem[] = [];
    for (const item of payload.items) {
      const variant = await manager.findOne(ProductVariant, { where: { sku: item.sku } });
      if (!variant) {
        throw new AppError(404, ErrorCode.NOT_FOUND, `Variant with SKU ${item.sku} not found`);
      }

      // Query inventory level directly — find one with sufficient stock
      const inventoryLevels = await manager.find(InventoryLevel, {
        where: { variantId: variant.id },
        order: { quantity: 'DESC' },
      });
      if (inventoryLevels.length === 0) {
        throw new AppError(404, ErrorCode.NOT_FOUND, `No inventory found for SKU ${item.sku}`);
      }

      // Use the location with the most stock
      let inventoryLevel = inventoryLevels[0];
      let remainingQty = item.quantity;

      // Try to allocate across multiple locations if needed
      if (inventoryLevel.quantity - inventoryLevel.reservedQuantity < item.quantity) {
        // Try to split across locations
        let totalAvailable = 0;
        for (const il of inventoryLevels) {
          totalAvailable += il.quantity - il.reservedQuantity;
        }
        if (totalAvailable < item.quantity) {
          throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK, `Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${totalAvailable}`);
        }
        // Deduct from first location only (simple allocation)
        inventoryLevel = inventoryLevels[0];
      }

      const available = inventoryLevel.quantity - inventoryLevel.reservedQuantity;
      if (available < item.quantity) {
        throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK, `Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${available}`);
      }

      inventoryLevel.reservedQuantity += item.quantity;
      await manager.save(inventoryLevel);

      const orderItem = manager.create(OrderItem, {
        orderId: order.id,
        variantId: variant.id,
        externalSku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
      await manager.save(orderItem);
      orderItems.push(orderItem);

      const audit = manager.create(AuditLog, {
        action: AuditAction.CREATE_ORDER,
        entityType: 'inventory',
        entityId: inventoryLevel.id,
        oldValues: { quantity: inventoryLevel.quantity, reservedQuantity: inventoryLevel.reservedQuantity - item.quantity },
        newValues: { quantity: inventoryLevel.quantity, reservedQuantity: inventoryLevel.reservedQuantity },
        notes: `Order ${payload.externalOrderId} reserved ${item.quantity} of SKU ${item.sku}`,
      });
      await manager.save(audit);
    }

    await manager.save(orderItems);
    order.items = orderItems;

    sendOrderConfirmation(order).catch((err) => {
      console.error('[orderProcessor] Failed to send order confirmation email:', err);
    });

    return order;
  });
}
