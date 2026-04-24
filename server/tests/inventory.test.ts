import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/inventory';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { StockAdjustment } from '../src/entities/StockAdjustment';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Inventory API', () => {
  test('GET / returns empty array when no inventory', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('GET / returns inventory levels with variant and location relations', async () => {
    await seed.location({ name: 'WH-A' });
    const { product } = await seed.product({ name: 'Gadget', sku: 'G-001' });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);

    const level = body[0];
    expect(level.id).toBeDefined();
    expect(level.quantity).toBe(100);
    expect(level.reservedQuantity).toBe(0);
    // variant relation
    expect(level.variant).toBeDefined();
    expect(level.variant.id).toBeDefined();
    // variant.product relation
    expect(level.variant.product).toBeDefined();
    expect(level.variant.product.name).toBe('Gadget');
    // location relation
    expect(level.location).toBeDefined();
    expect(level.location.name).toBe('WH-A');
  });

  test('POST /:id/adjust with positive quantityChange increases stock and creates adjustment + audit log', async () => {
    await seed.location({ name: 'WH-B' });
    const { product, variants } = await seed.product({ name: 'Widget', sku: 'W-002' });

    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    const levelId = levels[0].id;
    expect(levels[0].quantity).toBe(100);

    const res = await app.request(`/${levelId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: 50, reason: 'received' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Check inventory level updated
    expect(body.inventoryLevel.quantity).toBe(150);
    expect(body.inventoryLevel.id).toBe(levelId);

    // Check adjustment record
    expect(body.adjustment).toBeDefined();
    expect(body.adjustment.inventoryLevelId).toBe(levelId);
    expect(body.adjustment.quantityChange).toBe(50);
    expect(body.adjustment.previousQuantity).toBe(100);
    expect(body.adjustment.newQuantity).toBe(150);
    expect(body.adjustment.reason).toBe('received');

    // Verify adjustment persisted in DB
    const adjustments = await AppDataSource.getRepository(StockAdjustment).find();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].reason).toBe('received');

    // Verify audit log created
    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AuditAction.ADJUST_STOCK);
    expect(logs[0].entityType).toBe('inventory');
    expect(logs[0].entityId).toBe(levelId);
  });

  test('POST /:id/adjust with negative quantityChange decreases stock', async () => {
    await seed.location({ name: 'WH-C' });
    const { product } = await seed.product({ name: 'Thing', sku: 'T-001' });

    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    const levelId = levels[0].id;
    expect(levels[0].quantity).toBe(100);

    const res = await app.request(`/${levelId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: -30 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.inventoryLevel.quantity).toBe(70);
    expect(body.adjustment.quantityChange).toBe(-30);
    expect(body.adjustment.previousQuantity).toBe(100);
    expect(body.adjustment.newQuantity).toBe(70);

    // Verify DB state
    const updated = await AppDataSource.getRepository(InventoryLevel).findOne({ where: { id: levelId } });
    expect(updated!.quantity).toBe(70);
  });

  test('POST /:id/adjust rejects going below zero (400)', async () => {
    await seed.location({ name: 'WH-D' });
    const { product } = await seed.product({ name: 'Limited', sku: 'L-001' });

    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    const levelId = levels[0].id;
    expect(levels[0].quantity).toBe(100);

    const res = await app.request(`/${levelId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: -150 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/below zero/i);

    // Verify stock unchanged
    const unchanged = await AppDataSource.getRepository(InventoryLevel).findOne({ where: { id: levelId } });
    expect(unchanged!.quantity).toBe(100);

    // Verify no adjustment created
    const adjustments = await AppDataSource.getRepository(StockAdjustment).find();
    expect(adjustments).toHaveLength(0);
  });

  test('POST /:id/adjust rejects going below reserved quantity (400)', async () => {
    await seed.location({ name: 'WH-E' });
    const { product, variants } = await seed.product({ name: 'Reserved', sku: 'R-001' });
    const variant = variants[0];

    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    const levelId = levels[0].id;
    expect(levels[0].quantity).toBe(100);

    // Create order with item for this variant
    await seed.order({
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 50, unitPrice: 19.99 }],
    });

    // Manually set reserved quantity on the inventory level
    await AppDataSource.getRepository(InventoryLevel).update(levelId, { reservedQuantity: 50 });

    const res = await app.request(`/${levelId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: -60 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/below reserved/i);

    // Verify stock unchanged
    const unchanged = await AppDataSource.getRepository(InventoryLevel).findOne({ where: { id: levelId } });
    expect(unchanged!.quantity).toBe(100);
    expect(unchanged!.reservedQuantity).toBe(50);
  });

  test('POST /:id/adjust returns 404 for missing inventory level', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.request(`/${fakeId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: 10 }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toMatch(/not found/i);
  });

  test('POST /:id/adjust creates StockAdjustment with correct reason and metadata', async () => {
    await seed.location({ name: 'WH-F' });
    const { product } = await seed.product({ name: 'Meta', sku: 'M-001' });

    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    const levelId = levels[0].id;

    const res = await app.request(`/${levelId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantityChange: -5,
        reason: 'damaged',
        notes: 'Found broken during stocktake',
        adjustedBy: 'user-42',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.adjustment.reason).toBe('damaged');
    expect(body.adjustment.notes).toBe('Found broken during stocktake');
    expect(body.adjustment.adjustedBy).toBe('user-42');
    expect(body.adjustment.previousQuantity).toBe(100);
    expect(body.adjustment.newQuantity).toBe(95);
    expect(body.adjustment.quantityChange).toBe(-5);

    // Verify persisted
    const adjustments = await AppDataSource.getRepository(StockAdjustment).find();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].reason).toBe('damaged');
    expect(adjustments[0].notes).toBe('Found broken during stocktake');
    expect(adjustments[0].adjustedBy).toBe('user-42');
  });

  test('POST /:id/adjust creates AuditLog entry', async () => {
    await seed.location({ name: 'WH-G' });
    const { product } = await seed.product({ name: 'Audit', sku: 'A-001' });

    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    const levelId = levels[0].id;

    const res = await app.request(`/${levelId}/adjust`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantityChange: 25,
        reason: 'return',
        notes: 'Customer returned item',
        adjustedBy: 'admin-1',
      }),
    });
    expect(res.status).toBe(200);

    // Verify audit log in DB
    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);

    const log = logs[0];
    expect(log.action).toBe(AuditAction.ADJUST_STOCK);
    expect(log.entityType).toBe('inventory');
    expect(log.entityId).toBe(levelId);
    expect(log.oldValues).toEqual({ quantity: 100 });
    expect(log.newValues).toEqual({ quantity: 125 });
    expect(log.performedBy).toBe('admin-1');
    expect(log.notes).toContain('Stock adjusted: +25');
    expect(log.notes).toContain('return');
  });
});
