import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/orders';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';
import { OrderStatus } from '../src/entities/Order';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Orders API', () => {
  test('GET / returns empty array when no orders', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('GET / filters by status', async () => {
    await seed.order({ externalOrderId: 'ORD-A', status: OrderStatus.PENDING });
    await seed.order({ externalOrderId: 'ORD-B', status: OrderStatus.SHIPPED });
    await seed.order({ externalOrderId: 'ORD-C', status: OrderStatus.PENDING });

    const res = await app.request('/?status=pending', { headers: authHeader });
    expect(res.status).toBe(200);
    const orders = await res.json();
    expect(orders.data).toHaveLength(2);
    expect(orders.data.every((o: any) => o.status === 'pending')).toBe(true);

    const shippedRes = await app.request('/?status=shipped', { headers: authHeader });
    expect((await shippedRes.json()).data).toHaveLength(1);
  });

  test('GET /:id returns order with relations', async () => {
    const loc = await seed.location({ name: 'WH-Order' });
    const { product, variants } = await seed.product({ name: 'Order Product', sku: 'OP-001' });
    const variant = variants[0];

    const order = await seed.order({
      externalOrderId: 'ORD-REL-001',
      customerName: 'Jane Doe',
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 3, unitPrice: 10 }],
    });

    const res = await app.request(`/${order.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(order.id);
    expect(body.externalOrderId).toBe('ORD-REL-001');
    expect(body.customerName).toBe('Jane Doe');
    expect(body.items).toBeDefined();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(3);
  });

  test('GET /:id returns 404 for missing order', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id/status PACKED unreserves stock', async () => {
    const loc = await seed.location({ name: 'WH-Pack' });
    const { product, variants } = await seed.product({ sku: 'PACK-001' });
    const variant = variants[0];

    // Manually reserve stock (simulating order creation)
    const levels = await AppDataSource.getRepository(InventoryLevel).find({
      where: { variantId: variant.id },
    });
    expect(levels).toHaveLength(1);
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { reservedQuantity: 10 });
    expect(levels[0].quantity).toBe(100);

    const order = await seed.order({
      externalOrderId: 'PACK-ORDER',
      status: OrderStatus.CONFIRMED,
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 10, unitPrice: 5 }],
    });

    const res = await app.request(`/${order.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'packed' }),
    });
    expect(res.status).toBe(200);

    const updated = await AppDataSource.getRepository(InventoryLevel).findOne({ where: { id: levels[0].id } });
    expect(updated!.reservedQuantity).toBe(0); // 10 - 10 unreserved
    expect(updated!.quantity).toBe(100); // actual stock unchanged
  });

  test('PATCH /:id/status SHIPPED deducts stock and unreserves', async () => {
    const loc = await seed.location({ name: 'WH-Ship' });
    const { product, variants } = await seed.product({ sku: 'SHIP-001' });
    const variant = variants[0];

    const levels = await AppDataSource.getRepository(InventoryLevel).find({
      where: { variantId: variant.id },
    });
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { reservedQuantity: 5 });

    const order = await seed.order({
      externalOrderId: 'SHIP-ORDER',
      status: OrderStatus.PACKED, // already packed (unreserved above would be 0, but we set it to 5)
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 5, unitPrice: 8 }],
    });

    const res = await app.request(`/${order.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });
    expect(res.status).toBe(200);

    const updated = await AppDataSource.getRepository(InventoryLevel).findOne({ where: { id: levels[0].id } });
    expect(updated!.reservedQuantity).toBe(5); // reserved unchanged on shipped
    expect(updated!.quantity).toBe(95); // 100 - 5 deducted
  });

  test('PATCH /:id/status CANCELLED returns stock', async () => {
    const loc = await seed.location({ name: 'WH-Cancel' });
    const { product, variants } = await seed.product({ sku: 'CANCEL-001' });
    const variant = variants[0];

    const levels = await AppDataSource.getRepository(InventoryLevel).find({
      where: { variantId: variant.id },
    });
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { reservedQuantity: 7 });

    const order = await seed.order({
      externalOrderId: 'CANCEL-ORDER',
      status: OrderStatus.PENDING,
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 7, unitPrice: 12 }],
    });

    const res = await app.request(`/${order.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(200);

    const updated = await AppDataSource.getRepository(InventoryLevel).findOne({ where: { id: levels[0].id } });
    expect(updated!.reservedQuantity).toBe(0); // 7 - 7 unreserved
    expect(updated!.quantity).toBe(100); // actual stock unchanged
  });

  test('PATCH /:id/status returns 404 for missing order', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000/status', {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id/status creates audit log', async () => {
    const loc = await seed.location({ name: 'WH-Audit' });
    const { product, variants } = await seed.product({ sku: 'AUDIT-001' });

    const order = await seed.order({
      externalOrderId: 'AUDIT-ORDER',
      status: OrderStatus.PENDING,
    });

    const res = await app.request(`/${order.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBe(200);

    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AuditAction.UPDATE_ORDER_STATUS);
    expect(logs[0].entityType).toBe('order');
    expect(logs[0].entityId).toBe(order.id);
    expect(logs[0].oldValues).toEqual({ status: 'pending' });
    expect(logs[0].newValues).toEqual({ status: 'confirmed' });
    expect(logs[0].notes).toContain('pending');
    expect(logs[0].notes).toContain('confirmed');
  });
});
