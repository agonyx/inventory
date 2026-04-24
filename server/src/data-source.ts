import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Product } from './entities/Product';
import { ProductVariant } from './entities/ProductVariant';
import { Location } from './entities/Location';
import { InventoryLevel } from './entities/InventoryLevel';
import { Order } from './entities/Order';
import { OrderItem } from './entities/OrderItem';
import { StockAdjustment } from './entities/StockAdjustment';
import { AuditLog } from './entities/AuditLog';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: false,
  entities: [Product, ProductVariant, Location, InventoryLevel, Order, OrderItem, StockAdjustment, AuditLog],
  migrations: [__dirname + '/migrations/**/*.ts'],
});
if (import.meta.main) {
  const cmd = process.argv[2];
  AppDataSource.initialize().then(async (ds) => {
    if (cmd === 'sync') { await ds.synchronize(); console.log('Database synchronized'); }
    else if (cmd === 'drop') { await ds.dropDatabase(); console.log('Database dropped'); }
    else { console.log('Connected to database'); }
    await ds.destroy();
  }).catch((err) => { console.error('Database connection failed:', err); process.exit(1); });
}
