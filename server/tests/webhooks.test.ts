import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createHmac } from 'crypto';
import { initTestDb, destroyTestDb, cleanTables, seed } from './setup';
import app from '../src/routes/webhooks';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';
import { Order, OrderStatus } from '../src/entities/Order';

beforeAll(initTestDb);
afterAll(destroyTestDb);
beforeEach(cleanTables);

/** Sign a webhook payload with the current WEBHOOK_SECRET (or no-op if unset). */
function signPayload(body: string): Record<string, string> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return {};
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  return { 'X-Webhook-Signature': sig };
}

describe('Webhooks API', () => {
  test('POST /orders creates order and reserves stock', async () => {
    const loc = await seed.location({ name: 'WH-Webhook' });
    const { product, variants } = await seed.product({ name: 'Webhook Product', sku: 'WH-001' });
    const variant = variants[0];

    const bodyStr = JSON.stringify({
      externalOrderId: 'WH-EXT-001',
      customerName: 'Alice Smith',
      customerEmail: 'alice@example.com',
      totalAmount: 59.97,
      source: 'shopify',
      items: [{ sku: 'WH-001-STD', quantity: 3, unitPrice: 19.99 }],
    });

    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signPayload(bodyStr) },
      body: bodyStr,
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
    const bodyStr = JSON.stringify(payload);

    const first = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signPayload(bodyStr) },
      body: bodyStr,
    });
    expect(first.status).toBe(201);

    const second = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signPayload(bodyStr) },
      body: bodyStr,
    });
    expect(second.status).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.error.message).toContain('already exists');
    expect(secondBody.error.code).toBe('CONFLICT');
  });

  test('POST /orders rejects unknown SKU (404)', async () => {
    const bodyStr = JSON.stringify({
      externalOrderId: 'MISSING-SKU-001',
      customerName: 'Charlie',
      customerEmail: 'charlie@example.com',
      totalAmount: 10,
      source: 'test',
      items: [{ sku: 'NONEXISTENT-SKU', quantity: 1, unitPrice: 10 }],
    });
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signPayload(bodyStr) },
      body: bodyStr,
    });
    expect(res.status).toBe(404);
    const resBody = await res.json();
    expect(resBody.error.message).toContain('not found');
    expect(resBody.error.code).toBe('NOT_FOUND');
  });

  test('POST /orders rejects insufficient stock (400)', async () => {
    const loc = await seed.location({ name: 'WH-Low' });
    // Create product with only 2 units available
    const { product, variants } = await seed.product({ sku: 'LOW-001' });
    const variant = variants[0];

    // Set stock to 2, already reserved 1 → available = 1
    const levels = await AppDataSource.getRepository(InventoryLevel).find({ where: { variantId: variant.id } });
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { quantity: 2, reservedQuantity: 1 });

    const bodyStr = JSON.stringify({
      externalOrderId: 'LOW-STOCK-001',
      customerName: 'Dave',
      customerEmail: 'dave@example.com',
      totalAmount: 30,
      source: 'test',
      items: [{ sku: 'LOW-001-STD', quantity: 5, unitPrice: 6 }],
    });
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signPayload(bodyStr) },
      body: bodyStr,
    });
    expect(res.status).toBe(400);
    const resBody = await res.json();
    expect(resBody.error.message).toContain('Insufficient');
    expect(resBody.error.code).toBe('INSUFFICIENT_STOCK');
  });

  test('POST /orders validates input — missing required fields returns 400', async () => {
    const bodyStr = JSON.stringify({
      externalOrderId: 'BAD-001',
      // missing customerName, customerEmail, source, items
    });
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signPayload(bodyStr) },
      body: bodyStr,
    });
    expect(res.status).toBe(400);
  });

  test('POST /orders rejects missing signature when WEBHOOK_SECRET is set', async () => {
    const originalSecret = process.env.WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = 'whsec_test_secret_2026';

    try {
      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalOrderId: 'SIG-001',
          customerName: 'Test',
          customerEmail: 'test@example.com',
          totalAmount: 10,
          source: 'test',
          items: [{ sku: 'TEST-001', quantity: 1, unitPrice: 10 }],
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Missing');
    } finally {
      process.env.WEBHOOK_SECRET = originalSecret;
    }
  });

  test('POST /orders rejects invalid signature when WEBHOOK_SECRET is set', async () => {
    const originalSecret = process.env.WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = 'whsec_test_secret_2026';

    try {
      const payload = JSON.stringify({
        externalOrderId: 'SIG-002',
        customerName: 'Test',
        customerEmail: 'test@example.com',
        totalAmount: 10,
        source: 'test',
        items: [{ sku: 'TEST-001', quantity: 1, unitPrice: 10 }],
      });

      const res = await app.request('/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=invalid_signature',
        },
        body: payload,
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid');
    } finally {
      process.env.WEBHOOK_SECRET = originalSecret;
    }
  });

  test('POST /orders accepts valid signature when WEBHOOK_SECRET is set', async () => {
    const originalSecret = process.env.WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = 'whsec_test_secret_2026';

    try {
      await seed.location({ name: 'SIG-Loc' });
      const { product, variants } = await seed.product({ sku: 'SIG-003' });
      const payload = JSON.stringify({
        externalOrderId: 'SIG-003',
        customerName: 'Test',
        customerEmail: 'test@example.com',
        totalAmount: 10,
        source: 'test',
        items: [{ sku: 'SIG-003-STD', quantity: 1, unitPrice: 10 }],
      });

      const signature = 'sha256=' + createHmac('sha256', 'whsec_test_secret_2026').update(payload).digest('hex');

      const res = await app.request('/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body: payload,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    } finally {
      process.env.WEBHOOK_SECRET = originalSecret;
    }
  });

  test('POST /orders skips signature verification when WEBHOOK_SECRET is not set', async () => {
    const originalSecret = process.env.WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = '';

    try {
      await seed.location({ name: 'NOSIG-Loc' });
      const { product, variants } = await seed.product({ sku: 'NOSIG-001' });
      const payload = JSON.stringify({
        externalOrderId: 'NOSIG-001',
        customerName: 'Test',
        customerEmail: 'test@example.com',
        totalAmount: 10,
        source: 'test',
        items: [{ sku: 'NOSIG-001-STD', quantity: 1, unitPrice: 10 }],
      });

      // No X-Webhook-Signature header — should be accepted when no secret configured
      const res = await app.request('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    } finally {
      process.env.WEBHOOK_SECRET = originalSecret;
    }
  });
});
