import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/returns';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';
import { Return, ReturnStatus } from '../src/entities/Return';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Returns API', () => {
  test('GET / returns empty array when no returns', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('GET / filters by status', async () => {
    const order1 = await seed.order({ externalOrderId: 'ORD-R1' });
    const order2 = await seed.order({ externalOrderId: 'ORD-R2' });
    await seed.returnOrder({ orderId: order1.id, status: ReturnStatus.REQUESTED });
    await seed.returnOrder({ orderId: order2.id, status: ReturnStatus.APPROVED });

    const res = await app.request('/?status=requested', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].status).toBe('requested');
  });

  test('GET / filters by orderId', async () => {
    const order1 = await seed.order({ externalOrderId: 'ORD-FO1' });
    const order2 = await seed.order({ externalOrderId: 'ORD-FO2' });
    await seed.returnOrder({ orderId: order1.id });
    await seed.returnOrder({ orderId: order2.id });

    const res = await app.request(`/?orderId=${order1.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].orderId).toBe(order1.id);
  });

  test('POST / creates a return with items', async () => {
    const loc = await seed.location({ name: 'WH-Return' });
    const { product, variants } = await seed.product({ name: 'Return Product', sku: 'RP-001' });
    const variant = variants[0];
    const order = await seed.order({
      externalOrderId: 'ORD-CR',
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 5, unitPrice: 10 }],
    });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        reason: 'Wrong size',
        notes: 'Customer wants exchange',
        items: [
          { variantId: variant.id, quantity: 3, condition: 'new' },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.orderId).toBe(order.id);
    expect(body.reason).toBe('Wrong size');
    expect(body.status).toBe('requested');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(3);
    expect(body.items[0].condition).toBe('new');

    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AuditAction.CREATE_RETURN);
  });

  test('POST / returns 404 for missing order', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: '00000000-0000-0000-0000-000000000000',
        reason: 'Test',
        items: [{ variantId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
      }),
    });
    expect(res.status).toBe(404);
  });

  test('GET /:id returns return with relations', async () => {
    const loc = await seed.location({ name: 'WH-Get' });
    const { product, variants } = await seed.product({ sku: 'GET-R' });
    const variant = variants[0];
    const order = await seed.order({
      externalOrderId: 'ORD-GET',
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 2, unitPrice: 5 }],
    });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        reason: 'Test reason',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/${created.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].variant).toBeDefined();
    expect(body.order).toBeDefined();
  });

  test('GET /:id returns 404 for missing return', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id/approve changes status from requested to approved', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-AP' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.REQUESTED });

    const res = await app.request(`/${ret.id}/approve`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('approved');

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { action: AuditAction.APPROVE_RETURN },
    });
    expect(logs).toHaveLength(1);
  });

  test('PATCH /:id/approve rejects non-requested returns', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-AP2' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.APPROVED });

    const res = await app.request(`/${ret.id}/approve`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /:id/reject changes status from requested to rejected', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-RJ' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.REQUESTED });

    const res = await app.request(`/${ret.id}/reject`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('rejected');

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { action: AuditAction.REJECT_RETURN },
    });
    expect(logs).toHaveLength(1);
  });

  test('PATCH /:id/receive adjusts inventory', async () => {
    const loc = await seed.location({ name: 'WH-Recv' });
    const { product, variants } = await seed.product({ sku: 'RECV-001' });
    const variant = variants[0];

    const levels = await AppDataSource.getRepository(InventoryLevel).find({
      where: { variantId: variant.id },
    });
    expect(levels).toHaveLength(1);
    const originalQty = levels[0].quantity;

    const order = await seed.order({ externalOrderId: 'ORD-RCV' });
    const ret = await seed.returnOrder({
      orderId: order.id,
      status: ReturnStatus.APPROVED,
      items: [{ variantId: variant.id, quantity: 5, condition: 'new' }],
    });

    const res = await app.request(`/${ret.id}/receive`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('received');

    const updated = await AppDataSource.getRepository(InventoryLevel).findOne({
      where: { id: levels[0].id },
    });
    expect(updated!.quantity).toBe(originalQty + 5);

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { action: AuditAction.RECEIVE_RETURN },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /:id/receive rejects non-approved returns', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-RCV2' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.REQUESTED });

    const res = await app.request(`/${ret.id}/receive`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /:id/refund changes status from received to refunded', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-RF' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.RECEIVED });

    const res = await app.request(`/${ret.id}/refund`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('refunded');

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { action: AuditAction.REFUND_RETURN },
    });
    expect(logs).toHaveLength(1);
  });

  test('PATCH /:id/refund rejects non-received returns', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-RF2' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.APPROVED });

    const res = await app.request(`/${ret.id}/refund`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  test('DELETE /:id deletes a requested return', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-DL' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.REQUESTED });

    const res = await app.request(`/${ret.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(200);

    const found = await AppDataSource.getRepository(Return).findOne({ where: { id: ret.id } });
    expect(found).toBeNull();
  });

  test('DELETE /:id rejects non-requested returns', async () => {
    const order = await seed.order({ externalOrderId: 'ORD-DL2' });
    const ret = await seed.returnOrder({ orderId: order.id, status: ReturnStatus.APPROVED });

    const res = await app.request(`/${ret.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  test('DELETE /:id returns 404 for missing return', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });

  test('full return lifecycle: create → approve → receive → refund', async () => {
    const loc = await seed.location({ name: 'WH-Lifecycle' });
    const { product, variants } = await seed.product({ sku: 'LC-001' });
    const variant = variants[0];

    const levels = await AppDataSource.getRepository(InventoryLevel).find({
      where: { variantId: variant.id },
    });
    const originalQty = levels[0].quantity;

    const order = await seed.order({
      externalOrderId: 'ORD-LC',
      items: [{ variantId: variant.id, externalSku: variant.sku, quantity: 10, unitPrice: 20 }],
    });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        reason: 'Full lifecycle test',
        items: [{ variantId: variant.id, quantity: 4, condition: 'used' }],
      }),
    });
    expect(createRes.status).toBe(201);
    const { id } = await createRes.json();

    const approveRes = await app.request(`/${id}/approve`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json()).status).toBe('approved');

    const receiveRes = await app.request(`/${id}/receive`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    expect(receiveRes.status).toBe(200);
    expect((await receiveRes.json()).status).toBe('received');

    const updated = await AppDataSource.getRepository(InventoryLevel).findOne({
      where: { id: levels[0].id },
    });
    expect(updated!.quantity).toBe(originalQty + 4);

    const refundRes = await app.request(`/${id}/refund`, {
      method: 'PATCH',
      headers: authHeader,
    });
    expect(refundRes.status).toBe(200);
    expect((await refundRes.json()).status).toBe('refunded');

    const logs = await AppDataSource.getRepository(AuditLog).find();
    const actions = logs.map((l) => l.action);
    expect(actions).toContain(AuditAction.CREATE_RETURN);
    expect(actions).toContain(AuditAction.APPROVE_RETURN);
    expect(actions).toContain(AuditAction.RECEIVE_RETURN);
    expect(actions).toContain(AuditAction.REFUND_RETURN);
  });
});
