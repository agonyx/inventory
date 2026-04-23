import { AppDataSource } from '../data-source';
import { In } from 'typeorm';
import { InventoryLevel } from '../entities/InventoryLevel';
import { ProductVariant } from '../entities/ProductVariant';
import { Product } from '../entities/Product';
import { Location } from '../entities/Location';

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
  // Use direct queries instead of string-based relations
  const inventoryLevels = await AppDataSource.getRepository(InventoryLevel).find();
  if (inventoryLevels.length === 0) return [];

  const variantIds = [...new Set(inventoryLevels.map(l => l.variantId))];
  const variants = await AppDataSource.getRepository(ProductVariant).findBy({ id: In(variantIds) });

  const productIds = [...new Set(variants.map(v => v.productId))];
  const products = await AppDataSource.getRepository(Product).findBy({ id: In(productIds) });

  const locationIds = [...new Set(inventoryLevels.map(l => l.locationId))];
  const locations = await AppDataSource.getRepository(Location).findBy({ id: In(locationIds) });

  const variantMap = new Map(variants.map(v => [v.id, v]));
  const productMap = new Map(products.map(p => [p.id, p]));
  const locationMap = new Map(locations.map(l => [l.id, l]));

  const alerts: LowStockAlert[] = [];
  for (const level of inventoryLevels) {
    const variant = variantMap.get(level.variantId);
    if (!variant) continue;
    const product = productMap.get(variant.productId);
    if (!product) continue;
    const location = locationMap.get(level.locationId);
    if (!location) continue;

    const threshold = product.lowStockThreshold;
    if (threshold > 0 && level.quantity - level.reservedQuantity < threshold) {
      alerts.push({
        productId: product.id,
        productName: product.name,
        sku: variant.sku,
        variantId: variant.id,
        variantName: variant.name,
        locationId: location.id,
        locationName: location.name,
        currentQuantity: level.quantity - level.reservedQuantity,
        threshold,
        deficit: threshold - (level.quantity - level.reservedQuantity),
      });
    }
  }

  return alerts.sort((a, b) => b.deficit - a.deficit);
}
