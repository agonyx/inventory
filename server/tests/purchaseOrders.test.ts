import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/purchaseOrders';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Purchase Orders API', () => {
  test('GET / returns empty array when no purchase orders', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('POST / creates a purchase order with items', async () => {
    const supplier = await seed.supplier({ name: 'Test Supplier' });
    const { variants } = await seed.product({ name: 'Widget', sku: 'WDG-001' });
    const variant = variants[0];

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        notes: 'Test PO',
        items: [
          { variantId: variant.id, quantity: 10, unitCost: 5.00 },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.supplierId).toBe(supplier.id);
    expect(body.status).toBe('draft');
    expect(body.notes).toBe('Test PO');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].variantId).toBe(variant.id);
    expect(body.items[0].quantity).toBe(10);
    expect(Number(body.items[0].unitCost)).toBe(5);
    expect(body.items[0].receivedQuantity).toBe(0);
    expect(body.id).toBeDefined();
  });

  test('POST / rejects empty items', async () => {
    const supplier = await seed.supplier({ name: 'Test Supplier' });
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  test('GET / returns purchase orders with itemCount and totalCost', async () => {
    const supplier = await seed.supplier({ name: 'Supplier A' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-A' });
    const variant = variants[0];

    await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [
          { variantId: variant.id, quantity: 5, unitCost: 10.00 },
          { variantId: variant.id, quantity: 3, unitCost: 20.00 },
        ],
      }),
    });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].itemCount).toBe(2);
    expect(Number(body.data[0].totalCost)).toBeCloseTo(110, 1);
  });

  test('GET / supports filtering by status', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-F' });
    const variant = variants[0];

    await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 1, unitCost: 1 }],
      }),
    });

    const res = await app.request('/?status=sent', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  test('GET /:id returns a purchase order with items loaded', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-G' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 5, unitCost: 10.00 }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/${created.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.supplier.name).toBe('S1');
    expect(body.items[0].variant).toBeDefined();
  });

  test('GET /:id returns 404 for missing PO', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id updates notes', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-P' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 1, unitCost: 1 }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated notes' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toBe('Updated notes');
  });

  test('POST /:id/send changes draft to sent', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-S' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/${created.id}/send`, {
      method: 'POST',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('sent');
  });

  test('POST /:id/send rejects non-draft PO', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-S2' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });

    const res = await app.request(`/${created.id}/send`, {
      method: 'POST',
      headers: authHeader,
    });
    expect(res.status).toBe(409);
  });

  test('POST /:id/receive adjusts inventory and updates status', async () => {
    const location = await seed.location({ name: 'Main WH' });
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-R' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();
    const itemId = created.items[0].id;

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });

    const receiveRes = await app.request(`/${created.id}/receive`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ itemId, quantityReceived: 10 }],
      }),
    });
    expect(receiveRes.status).toBe(200);
    const body = await receiveRes.json();
    expect(body.status).toBe('received');
    expect(body.items[0].receivedQuantity).toBe(10);
  });

  test('POST /:id/receive partially receiving sets partially_received status', async () => {
    const location = await seed.location({ name: 'Main WH' });
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-PR' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();
    const itemId = created.items[0].id;

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });

    const receiveRes = await app.request(`/${created.id}/receive`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ itemId, quantityReceived: 5 }],
      }),
    });
    expect(receiveRes.status).toBe(200);
    const body = await receiveRes.json();
    expect(body.status).toBe('partially_received');
    expect(body.items[0].receivedQuantity).toBe(5);
  });

  test('POST /:id/receive rejects receiving more than ordered', async () => {
    const location = await seed.location({ name: 'Main WH' });
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-RO' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();
    const itemId = created.items[0].id;

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });

    const receiveRes = await app.request(`/${created.id}/receive`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ itemId, quantityReceived: 15 }],
      }),
    });
    expect(receiveRes.status).toBe(409);
  });

  test('POST /:id/receive rejects non-sent PO', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-RN' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();
    const itemId = created.items[0].id;

    const receiveRes = await app.request(`/${created.id}/receive`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ itemId, quantityReceived: 5 }],
      }),
    });
    expect(receiveRes.status).toBe(409);
  });

  test('POST /:id/cancel cancels a sent PO', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-C' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });

    const res = await app.request(`/${created.id}/cancel`, {
      method: 'POST',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('cancelled');
  });

  test('POST /:id/cancel rejects cancelling a received PO', async () => {
    const location = await seed.location({ name: 'WH' });
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-CR' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();
    const itemId = created.items[0].id;

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });
    await app.request(`/${created.id}/receive`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ itemId, quantityReceived: 10 }] }),
    });

    const res = await app.request(`/${created.id}/cancel`, {
      method: 'POST',
      headers: authHeader,
    });
    expect(res.status).toBe(409);
  });

  test('DELETE /:id deletes a draft PO', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-D' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/${created.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  test('DELETE /:id rejects deleting a sent PO', async () => {
    const supplier = await seed.supplier({ name: 'S1' });
    const { variants } = await seed.product({ name: 'P1', sku: 'SKU-DS' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      }),
    });
    const created = await createRes.json();

    await app.request(`/${created.id}/send`, { method: 'POST', headers: authHeader });

    const res = await app.request(`/${created.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(409);
  });

  test('DELETE /:id returns 404 for missing PO', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
