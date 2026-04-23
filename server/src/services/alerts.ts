import { AppDataSource } from '../data-source';
import { InventoryLevel } from '../entities/InventoryLevel';

export interface LowStockAlert {
  productId: string;
  productName: string;
  sku: string;
  variantId: string;
  variantName: string;
  locationId: string;
  locationName: string;
  currentQuantity: number;
  threshold: number;
  deficit: number;
}

export async function getLowStockAlerts(): Promise<LowStockAlert[]> {
  const inventoryLevels = await AppDataSource.getRepository(InventoryLevel).find({
    relations: ['variant', 'variant.product', 'location'],
  });

  const alerts: LowStockAlert[] = [];
  for (const level of inventoryLevels) {
    const product = (level.variant as any).product;
    const threshold = product?.lowStockThreshold;
    if (threshold > 0 && level.quantity - level.reservedQuantity < threshold) {
      alerts.push({
        productId: product.id,
        productName: product.name,
        sku: level.variant.sku,
        variantId: level.variant.id,
        variantName: level.variant.name,
        locationId: level.location.id,
        locationName: level.location.name,
        currentQuantity: level.quantity - level.reservedQuantity,
        threshold,
        deficit: threshold - (level.quantity - level.reservedQuantity),
      });
    }
  }

  return alerts.sort((a, b) => b.deficit - a.deficit);
}
