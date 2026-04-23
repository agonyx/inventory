import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { InventoryLevel } from '../entities/InventoryLevel';
import { ProductVariant } from '../entities/ProductVariant';
import { AuditLog, AuditAction } from '../entities/AuditLog';

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
      throw new Error(`Order ${payload.externalOrderId} already exists`);
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
      const variant = await manager.findOne(ProductVariant, { where: { sku: item.sku }, relations: ['inventoryLevels'] });
      if (!variant) {
        throw new Error(`Variant with SKU ${item.sku} not found`);
      }

      const inventoryLevel = variant.inventoryLevels[0];
      if (!inventoryLevel) {
        throw new Error(`No inventory found for SKU ${item.sku}`);
      }

      const available = inventoryLevel.quantity - inventoryLevel.reservedQuantity;
      if (available < item.quantity) {
        throw new Error(`Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${available}`);
      }

      inventoryLevel.quantity -= item.quantity;
      inventoryLevel.reservedQuantity += item.quantity;
      await manager.save(inventoryLevel);

      const orderItem = manager.create(OrderItem, {
        orderId: order.id,
        variantId: variant.id,
        externalSku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
      orderItems.push(orderItem);

      const audit = manager.create(AuditLog, {
        action: AuditAction.CREATE_ORDER,
        entityType: 'inventory',
        entityId: inventoryLevel.id,
        oldValues: { quantity: inventoryLevel.quantity + item.quantity, reservedQuantity: inventoryLevel.reservedQuantity - item.quantity },
        newValues: { quantity: inventoryLevel.quantity, reservedQuantity: inventoryLevel.reservedQuantity },
        notes: `Order ${payload.externalOrderId} reserved ${item.quantity} of SKU ${item.sku}`,
      });
      await manager.save(audit);
    }

    await manager.save(orderItems);
    order.items = orderItems;
    return order;
  });
}
