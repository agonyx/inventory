import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, authHeader } from './setup';
import app from '../src/routes/products';

beforeAll(initTestDb);
afterAll(destroyTestDb);
beforeEach(cleanTables);

describe('Products API', () => {
  test('GET / returns empty array when no products', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('POST / creates a product', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Widget', sku: 'W-001', price: 9.99 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Widget');
    expect(body.sku).toBe('W-001');
  });

  test('POST / with variants creates product, variants, and inventory levels', async () => {
    await seed.location({ name: 'WH-A' });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Gadget', sku: 'G-001', price: 25,
        variants: [
          { name: 'Small', sku: 'G-001-S' },
          { name: 'Large', sku: 'G-001-L' },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.variants).toHaveLength(2);
    for (const v of body.variants) {
      expect(v.inventoryLevels).toHaveLength(1);
      expect(v.inventoryLevels[0].quantity).toBe(0);
    }
  });

  test('POST / rejects invalid input (missing name)', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'X-001' }),
    });
    expect(res.status).toBe(400);
  });

  test('GET /:id returns product with relations', async () => {
    const { product } = await seed.product({ name: 'FindMe', sku: 'FM-001' });
    const res = await app.request(`/${product.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('FindMe');
  });

  test('GET /:id returns 404 for missing product', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id updates a product', async () => {
    const { product } = await seed.product({ name: 'OldName', sku: 'PN-001' });
    const res = await app.request(`/${product.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewName', price: 49.99 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('NewName');
  });

  test('DELETE /:id deletes product', async () => {
    const { product } = await seed.product({ name: 'ToDelete', sku: 'TD-001' });
    const res = await app.request(`/${product.id}`, { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(200);

    const getRes = await app.request(`/${product.id}`, { headers: authHeader });
    expect(getRes.status).toBe(404);
  });
});
