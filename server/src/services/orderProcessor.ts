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
  const result = await AppDataSource.transaction(async (manager) => {
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

      const inventoryLevels = await manager.find(InventoryLevel, {
        where: { variantId: variant.id },
        order: { quantity: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (inventoryLevels.length === 0) {
        throw new AppError(404, ErrorCode.NOT_FOUND, `No inventory found for SKU ${item.sku}`);
      }

      let remainingQty = item.quantity;

      let primaryAvailable = inventoryLevels.reduce(
        (sum, il) => sum + il.quantity - il.reservedQuantity, 0,
      );
      if (primaryAvailable < item.quantity) {
        throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK, `Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${primaryAvailable}`);
      }

      for (const il of inventoryLevels) {
        if (remainingQty <= 0) break;
        const avail = il.quantity - il.reservedQuantity;
        if (avail <= 0) continue;
        const allocate = Math.min(avail, remainingQty);
        il.reservedQuantity += allocate;
        await manager.save(il);
        remainingQty -= allocate;

        const audit = manager.create(AuditLog, {
          action: AuditAction.CREATE_ORDER,
          entityType: 'inventory',
          entityId: il.id,
          oldValues: { quantity: il.quantity, reservedQuantity: il.reservedQuantity - allocate },
          newValues: { quantity: il.quantity, reservedQuantity: il.reservedQuantity },
          notes: `Order ${payload.externalOrderId} reserved ${allocate} of SKU ${item.sku}`,
        });
        await manager.save(audit);
      }

      if (remainingQty > 0) {
        throw new AppError(400, ErrorCode.INSUFFICIENT_STOCK, `Failed to fully allocate stock for SKU ${item.sku}`);
      }

      const orderItem = manager.create(OrderItem, {
        orderId: order.id,
        variantId: variant.id,
        externalSku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
      await manager.save(orderItem);
      orderItems.push(orderItem);
    }

    order.items = orderItems;

    return order;
  });

  sendOrderConfirmation(result).catch((err) => {
    console.error('[orderProcessor] Failed to send order confirmation email:', err);
  });

  return result;
}
