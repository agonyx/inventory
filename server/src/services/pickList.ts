import { AppDataSource } from '../data-source';
import { In } from 'typeorm';
import { Order, OrderStatus } from '../entities/Order';
import { InventoryLevel } from '../entities/InventoryLevel';
import { ProductVariant } from '../entities/ProductVariant';
import { Product } from '../entities/Product';
import { Location } from '../entities/Location';

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
    relations: ['items'],
    order: { createdAt: 'ASC' },
  });

  if (orders.length === 0) return [];

  // Batch-fetch all variant/product/location info
  const variantIds = orders.flatMap(o => o.items.map(i => i.variantId).filter((v): v is string => v !== null));
  const variants = variantIds.length > 0
    ? await AppDataSource.getRepository(ProductVariant).findBy({ id: In(variantIds) })
    : [];

  const productIds = variants.map(v => v.productId);
  const products = productIds.length > 0
    ? await AppDataSource.getRepository(Product).findBy({ id: In(productIds) })
    : [];

  // Get inventory levels for these variants
  const inventoryLevels = variantIds.length > 0
    ? await AppDataSource.getRepository(InventoryLevel).find({
        where: variantIds.map(vid => ({ variantId: vid })),
        relations: ['location'],
      })
    : [];

  const variantMap = new Map(variants.map(v => [v.id, v]));
  const productMap = new Map(products.map(p => [p.id, p]));
  const inventoryByVariant = new Map<string, InventoryLevel[]>();
  for (const inv of inventoryLevels) {
    const list = inventoryByVariant.get(inv.variantId) || [];
    list.push(inv);
    inventoryByVariant.set(inv.variantId, list);
  }

  const pickList: PickListItem[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.variantId) continue;
      const variant = variantMap.get(item.variantId);
      if (!variant) continue;
      const product = productMap.get(variant.productId);
      const invLevels = inventoryByVariant.get(variant.id) || [];
      const invLevel = invLevels[0];

      pickList.push({
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        customerName: order.customerName,
        productName: product?.name || 'Unknown',
        variantName: variant.name,
        sku: item.externalSku || variant.sku,
        quantity: item.quantity,
        locationName: invLevel?.location?.name || 'Unassigned',
        locationType: invLevel?.location?.type || null,
        status: order.status,
      });
    }
  }

  return pickList.sort((a, b) => {
    if (a.locationName !== b.locationName) return a.locationName.localeCompare(b.locationName);
    return a.productName.localeCompare(b.productName);
  });
}
