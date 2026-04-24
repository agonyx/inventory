/**
 * Test database setup for integration tests.
 * Import this FIRST in every test file (before any src/ imports).
 */
import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

// Point to test database BEFORE data-source.ts is evaluated
const origUrl = process.env.DATABASE_URL!;
process.env.DATABASE_URL = origUrl.replace(/\/[^/]+$/, '/niche_inventory_test');

import { AppDataSource } from '../src/data-source';
import { Product } from '../src/entities/Product';
import { ProductVariant } from '../src/entities/ProductVariant';
import { Location } from '../src/entities/Location';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { Order, OrderStatus } from '../src/entities/Order';
import { OrderItem } from '../src/entities/OrderItem';
import { AuditLog } from '../src/entities/AuditLog';
import { User, UserRole } from '../src/entities/User';
import { generateTokens } from '../src/services/auth';

export const AUTH_TOKEN = process.env.AUTH_TOKEN || 'niche-inventory-secret-2026';

// Create a test user and generate a JWT token for it
let testUser: User | null = null;

export async function getTestAuthHeader() {
  if (!testUser) {
    const userRepo = AppDataSource.getRepository(User);
    testUser = userRepo.create({
      email: 'test@example.com',
      passwordHash: 'not-used-in-tests',
      name: 'Test User',
      role: UserRole.ADMIN,
    });
    testUser = await userRepo.save(testUser);
  }
  const { accessToken } = generateTokens(testUser);
  return { Authorization: `Bearer ${accessToken}` };
}

/** Call in beforeAll — initializes test DB, drops/recreates schema */
export async function initTestDb() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.synchronize(true); // drop + recreate
}

/** Call in afterAll — closes the connection */
export async function destroyTestDb() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

/** Call in beforeEach — truncates all tables */
export async function cleanTables() {
  if (!AppDataSource.isInitialized) return;
  await AppDataSource.query(`
    TRUNCATE TABLE audit_logs, stock_adjustments, order_items, orders,
             inventory_levels, product_variants, products, locations, users
    RESTART IDENTITY CASCADE
  `);
  // Reset cached test user after truncate
  testUser = null;
}

// ─── Seed helpers ──────────────────────────────────────────────────

export const seed = {
  async location(overrides: Partial<Location> = {}) {
    const repo = AppDataSource.getRepository(Location);
    return repo.save(repo.create({ name: 'Test Warehouse', type: 'warehouse', ...overrides }));
  },

  async product(overrides: Partial<Product> = {}, variants: Partial<ProductVariant>[] = []) {
    const locRepo = AppDataSource.getRepository(Location);
    const prodRepo = AppDataSource.getRepository(Product);
    const varRepo = AppDataSource.getRepository(ProductVariant);
    const invRepo = AppDataSource.getRepository(InventoryLevel);

    const product = await prodRepo.save(prodRepo.create({
      name: 'Test Product',
      sku: 'TP-001',
      price: '19.99',
      lowStockThreshold: 5,
      ...overrides,
    }));

    const savedVariants: ProductVariant[] = [];
    const defaultVariants = variants.length > 0
      ? variants
      : [{ name: 'Standard', sku: `${overrides.sku || 'TP-001'}-STD` }];

    for (const v of defaultVariants) {
      const variant = await varRepo.save(varRepo.create({ ...v, productId: product.id }));
      savedVariants.push(variant);
    }

    const locations = await locRepo.find();
    for (const variant of savedVariants) {
      for (const loc of locations) {
        await invRepo.save(invRepo.create({
          variantId: variant.id,
          locationId: loc.id,
          quantity: 100,
          reservedQuantity: 0,
        }));
      }
    }

    return { product, variants: savedVariants };
  },

  async order(overrides: Partial<Order> & { items?: Partial<OrderItem>[] } = {}) {
    const { items, ...orderOverrides } = overrides;
    const repo = AppDataSource.getRepository(Order);
    const itemRepo = AppDataSource.getRepository(OrderItem);
    const order = await repo.save(repo.create({
      externalOrderId: 'EXT-001',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      totalAmount: '29.99',
      source: 'test',
      status: OrderStatus.PENDING,
      ...orderOverrides,
    }));

    if (items) {
      for (const i of items) {
        await itemRepo.save(itemRepo.create({ orderId: order.id, ...i }));
      }
    }
    return order;
  },
};

process.on('exit', () => { process.env.DATABASE_URL = origUrl; });
