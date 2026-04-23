import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';

export interface PickListItem {
  orderId: string;
  externalOrderId: string;
  customerName: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  locationName: string;
  locationType: string | null;
  status: OrderStatus;
}

export async function generatePickList(): Promise<PickListItem[]> {
  const orders = await AppDataSource.getRepository(Order).find({
    where: { status: OrderStatus.PENDING },
    relations: ['items', 'items.variant', 'items.variant.product', 'items.variant.inventoryLevels', 'items.variant.inventoryLevels.location'],
  });

  const pickList: PickListItem[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.variant) continue;
      const inventoryLevel = item.variant.inventoryLevels[0];
      pickList.push({
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        customerName: order.customerName,
        productName: (item.variant as any).product?.name || 'Unknown',
        variantName: item.variant.name,
        sku: item.externalSku || item.variant.sku,
        quantity: item.quantity,
        locationName: inventoryLevel?.location?.name || 'Unknown',
        locationType: inventoryLevel?.location?.type || null,
        status: order.status,
      });
    }
  }

  // Sort by location then product for efficient warehouse walking
  return pickList.sort((a, b) => {
    if (a.locationName !== b.locationName) return a.locationName.localeCompare(b.locationName);
    return a.productName.localeCompare(b.productName);
  });
}
