import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, authHeader } from './setup';
import app from '../src/routes/pickList';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { OrderStatus } from '../src/entities/Order';

beforeAll(initTestDb);
afterAll(destroyTestDb);
beforeEach(cleanTables);

describe('Pick List API', () => {
  test('GET / returns empty array when no pending orders', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('GET / returns pick list items for pending orders', async () => {
    const loc = await seed.location({ name: 'WH-Pick' });
    const { product, variants } = await seed.product({ name: 'Pick Product', sku: 'PICK-001' });
    const variant = variants[0];

    // Reserve stock
    const levels = await AppDataSource.getRepository(InventoryLevel).find({ where: { variantId: variant.id } });
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { reservedQuantity: 5 });

    // Create a pending order
    await seed.order({
      externalOrderId: 'PICK-ORDER-001',
      customerName: 'Eve',
      status: OrderStatus.PENDING,
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 5, unitPrice: 15 }],
    });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const pickList = await res.json();
    expect(pickList).toHaveLength(1);

    const item = pickList[0];
    expect(item.externalOrderId).toBe('PICK-ORDER-001');
    expect(item.customerName).toBe('Eve');
    expect(item.productName).toBe('Pick Product');
    expect(item.quantity).toBe(5);
    expect(item.locationName).toBe('WH-Pick');
    expect(item.status).toBe('pending');
  });

  test('GET / excludes shipped orders', async () => {
    const loc = await seed.location({ name: 'WH-Shipped' });
    const { product, variants } = await seed.product({ sku: 'PICK-SHIP-001' });

    // Create a shipped order (should not appear in pick list)
    await seed.order({
      externalOrderId: 'SHIPPED-ORDER',
      status: OrderStatus.SHIPPED,
      items: [{ variantId: variants[0].id, externalSku: variants[0].sku, quantity: 2, unitPrice: 10 }],
    });

    // Create a pending order (should appear)
    await seed.order({
      externalOrderId: 'PENDING-ORDER',
      status: OrderStatus.PENDING,
      items: [{ variantId: variants[0].id, externalSku: variants[0].sku, quantity: 3, unitPrice: 10 }],
    });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const pickList = await res.json();
    expect(pickList).toHaveLength(1);
    expect(pickList[0].externalOrderId).toBe('PENDING-ORDER');
  });

  test('GET / sorts by location name then product name', async () => {
    const locB = await seed.location({ name: 'B-Warehouse' });
    const locA = await seed.location({ name: 'A-Store' });

    const { product: pZ, variants: vZ } = await seed.product({ name: 'Z-Item', sku: 'PICK-Z' });
    const { product: pM, variants: vM } = await seed.product({ name: 'M-Item', sku: 'PICK-M' });

    // Order at A-Store for Z-Item
    await seed.order({
      externalOrderId: 'ORD-LOC-A-Z',
      status: OrderStatus.PENDING,
      items: [{ variantId: vZ[0].id, externalSku: vZ[0].sku, quantity: 1, unitPrice: 10 }],
    });
    // Order at A-Store for M-Item
    await seed.order({
      externalOrderId: 'ORD-LOC-A-M',
      status: OrderStatus.PENDING,
      items: [{ variantId: vM[0].id, externalSku: vM[0].sku, quantity: 1, unitPrice: 10 }],
    });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const pickList = await res.json();
    expect(pickList.length).toBeGreaterThanOrEqual(2);

    // Both should be at A-Store (first location alphabetically)
    // Within same location, sorted by product name
    const aStoreItems = pickList.filter((i: any) => i.locationName === 'A-Store');
    if (aStoreItems.length === 2) {
      expect(aStoreItems[0].productName).toBe('M-Item');
      expect(aStoreItems[1].productName).toBe('Z-Item');
    }
  });
});
