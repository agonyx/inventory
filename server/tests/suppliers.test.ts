import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/suppliers';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Suppliers API', () => {
  test('GET / returns empty array when no suppliers', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('GET / returns suppliers sorted by name ASC', async () => {
    await seed.supplier({ name: 'Charlie Supplies' });
    await seed.supplier({ name: 'Alpha Parts' });
    await seed.supplier({ name: 'Beta Components' });

    const res = await app.request('/?sortDir=asc', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.data[0].name).toBe('Alpha Parts');
    expect(body.data[1].name).toBe('Beta Components');
    expect(body.data[2].name).toBe('Charlie Supplies');
  });

  test('GET / supports search by name', async () => {
    await seed.supplier({ name: 'Alpha Parts' });
    await seed.supplier({ name: 'Beta Components' });

    const res = await app.request('/?search=Alpha', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Alpha Parts');
  });

  test('POST / creates a supplier with all fields', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Acme Supplies',
        contactName: 'Jane Doe',
        email: 'jane@acme.com',
        phone: '+1 555-0123',
        address: '123 Commerce St, NY',
        notes: 'Preferred vendor',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Acme Supplies');
    expect(body.contactName).toBe('Jane Doe');
    expect(body.email).toBe('jane@acme.com');
    expect(body.phone).toBe('+1 555-0123');
    expect(body.address).toBe('123 Commerce St, NY');
    expect(body.notes).toBe('Preferred vendor');
    expect(body.id).toBeDefined();
  });

  test('POST / creates a supplier with name only', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Minimal Supplier' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Minimal Supplier');
    expect(body.contactName).toBeNull();
    expect(body.email).toBeNull();
  });

  test('POST / rejects missing name (400)', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactName: 'Jane' }),
    });
    expect(res.status).toBe(400);
  });

  test('GET /:id returns a single supplier', async () => {
    const supplier = await seed.supplier({ name: 'Find Me' });
    const res = await app.request(`/${supplier.id}`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Find Me');
  });

  test('GET /:id returns 404 for missing supplier', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id updates supplier fields', async () => {
    const supplier = await seed.supplier({ name: 'Old Name', contactName: 'Old Contact' });
    const res = await app.request(`/${supplier.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name', phone: '+1 555-9999' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New Name');
    expect(body.contactName).toBe('Old Contact');
    expect(body.phone).toBe('+1 555-9999');
  });

  test('PATCH /:id returns 404 for missing supplier', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    expect(res.status).toBe(404);
  });

  test('DELETE /:id deletes a supplier without products', async () => {
    const supplier = await seed.supplier({ name: 'Delete Me' });
    const res = await app.request(`/${supplier.id}`, { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const listRes = await app.request('/', { headers: authHeader });
    expect((await listRes.json()).data).toHaveLength(0);
  });

  test('DELETE /:id returns 404 for missing supplier', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });

  test('DELETE /:id returns 409 if products reference this supplier', async () => {
    const supplier = await seed.supplier({ name: 'Linked Supplier' });
    await seed.product({ name: 'Linked Product', sku: 'LP-001', supplierId: supplier.id });

    const res = await app.request(`/${supplier.id}`, { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(409);
  });

  test('GET / returns productCount per supplier', async () => {
    const s1 = await seed.supplier({ name: 'With Products' });
    const s2 = await seed.supplier({ name: 'No Products' });
    await seed.product({ name: 'P1', sku: 'SKU1', supplierId: s1.id });
    await seed.product({ name: 'P2', sku: 'SKU2', supplierId: s1.id });

    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);

    const withProducts = body.data.find((s: any) => s.name === 'With Products');
    const noProducts = body.data.find((s: any) => s.name === 'No Products');
    expect(withProducts.productCount).toBe(2);
    expect(noProducts.productCount).toBe(0);
  });
});
