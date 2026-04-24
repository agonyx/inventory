import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/alerts';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Alerts API', () => {
  test('GET / returns empty array when no products', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('GET / returns alerts for products below low stock threshold', async () => {
    const loc = await seed.location({ name: 'WH-Alert' });
    // Product with threshold=10, but only 5 units available
    const { product, variants } = await seed.product({ sku: 'ALERT-001', lowStockThreshold: 10 });
    // seed.product creates inventory with quantity=100 — manually reduce it
    const { InventoryLevel: IL } = await import('../src/entities/InventoryLevel');
    const { AppDataSource: DS } = await import('../src/data-source');
    const levels = await DS.getRepository(IL).find();
    await DS.getRepository(IL).update(levels[0].id, { quantity: 5, reservedQuantity: 0 });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const alerts = await res.json();
    expect(alerts.length).toBeGreaterThan(0);

    const alert = alerts[0];
    expect(alert.productName).toBe('Test Product');
    expect(alert.threshold).toBe(10);
    expect(alert.currentQuantity).toBe(5);
    expect(alert.deficit).toBe(5);
    expect(alert.locationName).toBe('WH-Alert');
  });

  test('GET / returns empty when stock is above threshold', async () => {
    const loc = await seed.location({ name: 'WH-OK' });
    // Product with threshold=5, 100 units (seed default) — well above
    await seed.product({ sku: 'OK-001', lowStockThreshold: 5 });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('GET / returns alerts sorted by deficit descending', async () => {
    const loc = await seed.location({ name: 'WH-Sort' });
    const { InventoryLevel: IL } = await import('../src/entities/InventoryLevel');
    const { AppDataSource: DS } = await import('../src/data-source');

    // Product A: threshold=20, qty=5 → deficit=15
    const { product: pA, variants: vA } = await seed.product({ name: 'Product A', sku: 'SORT-A', lowStockThreshold: 20 });
    // Product B: threshold=10, qty=8 → deficit=2
    const { product: pB, variants: vB } = await seed.product({ name: 'Product B', sku: 'SORT-B', lowStockThreshold: 10 });

    // Reduce stock levels
    const allLevels = await DS.getRepository(IL).find();
    await DS.getRepository(IL).update(allLevels[0].id, { quantity: 5 }); // Product A
    await DS.getRepository(IL).update(allLevels[1].id, { quantity: 8 }); // Product B

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const alerts = await res.json();
    expect(alerts).toHaveLength(2);
    expect(alerts[0].deficit).toBeGreaterThanOrEqual(alerts[1].deficit);
  });
});
