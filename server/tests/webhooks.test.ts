import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed } from './setup';
import app from '../src/routes/webhooks';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';
import { Order, OrderStatus } from '../src/entities/Order';

beforeAll(initTestDb);
afterAll(destroyTestDb);
beforeEach(cleanTables);

describe('Webhooks API', () => {
  test('POST /orders creates order and reserves stock', async () => {
    const loc = await seed.location({ name: 'WH-Webhook' });
    const { product, variants } = await seed.product({ name: 'Webhook Product', sku: 'WH-001' });
    const variant = variants[0];

    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalOrderId: 'WH-EXT-001',
        customerName: 'Alice Smith',
        customerEmail: 'alice@example.com',
        totalAmount: 59.97,
        source: 'shopify',
        items: [{ sku: 'WH-001-STD', quantity: 3, unitPrice: 19.99 }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.externalOrderId).toBe('WH-EXT-001');
    expect(body.status).toBe('pending');
    expect(body.orderId).toBeDefined();

    // Verify stock was reserved
    const levels = await AppDataSource.getRepository(InventoryLevel).find({ where: { variantId: variant.id } });
    expect(levels).toHaveLength(1);
    expect(levels[0].reservedQuantity).toBe(3);
    expect(levels[0].quantity).toBe(100); // unchanged

    // Verify order created in DB
    const orders = await AppDataSource.getRepository(Order).find();
    expect(orders).toHaveLength(1);
    expect(orders[0].externalOrderId).toBe('WH-EXT-001');
    expect(orders[0].customerName).toBe('Alice Smith');

    // Verify audit log
    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AuditAction.CREATE_ORDER);
  });

  test('POST /orders rejects duplicate externalOrderId (409)', async () => {
    const loc = await seed.location({ name: 'WH-Dup' });
    const { product, variants } = await seed.product({ sku: 'DUP-001' });

    const payload = {
      externalOrderId: 'DUP-EXT-001',
      customerName: 'Bob',
      customerEmail: 'bob@example.com',
      totalAmount: 10,
      source: 'woocommerce',
      items: [{ sku: 'DUP-001-STD', quantity: 1, unitPrice: 10 }],
    };

    const first = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);

    const second = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toContain('already exists');
  });

  test('POST /orders rejects unknown SKU (404)', async () => {
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalOrderId: 'MISSING-SKU-001',
        customerName: 'Charlie',
        customerEmail: 'charlie@example.com',
        totalAmount: 10,
        source: 'test',
        items: [{ sku: 'NONEXISTENT-SKU', quantity: 1, unitPrice: 10 }],
      }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('not found');
  });

  test('POST /orders rejects insufficient stock (400)', async () => {
    const loc = await seed.location({ name: 'WH-Low' });
    // Create product with only 2 units available
    const { product, variants } = await seed.product({ sku: 'LOW-001' });
    const variant = variants[0];

    // Set stock to 2, already reserved 1 → available = 1
    const levels = await AppDataSource.getRepository(InventoryLevel).find({ where: { variantId: variant.id } });
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { quantity: 2, reservedQuantity: 1 });

    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalOrderId: 'LOW-STOCK-001',
        customerName: 'Dave',
        customerEmail: 'dave@example.com',
        totalAmount: 30,
        source: 'test',
        items: [{ sku: 'LOW-001-STD', quantity: 5, unitPrice: 6 }],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Insufficient');
  });

  test('POST /orders validates input — missing required fields returns 400', async () => {
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalOrderId: 'BAD-001',
        // missing customerName, customerEmail, source, items
      }),
    });
    expect(res.status).toBe(400);
  });
});
