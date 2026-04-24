import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/locations';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Locations API', () => {
  test('GET / returns empty array when no locations', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('GET / returns locations sorted by name ASC', async () => {
    await seed.location({ name: 'Charlie Warehouse' });
    await seed.location({ name: 'Alpha Store' });
    await seed.location({ name: 'Beta Depot' });

    const res = await app.request('/?sortDir=asc', { headers: authHeader });
    expect(res.status).toBe(200);
    const locations = await res.json();
    expect(locations.data).toHaveLength(3);
    expect(locations.data[0].name).toBe('Alpha Store');
    expect(locations.data[1].name).toBe('Beta Depot');
    expect(locations.data[2].name).toBe('Charlie Warehouse');
  });

  test('POST / creates a location with all fields', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Main Warehouse', type: 'warehouse', address: '123 Commerce St' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Main Warehouse');
    expect(body.type).toBe('warehouse');
    expect(body.address).toBe('123 Commerce St');
    expect(body.id).toBeDefined();
  });

  test('POST / creates a location with name only', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pop-up Shop' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Pop-up Shop');
    expect(body.type).toBeNull();
    expect(body.address).toBeNull();
  });

  test('POST / rejects missing name (400)', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'store' }),
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /:id updates location fields', async () => {
    const loc = await seed.location({ name: 'Old Name', type: 'warehouse' });
    const res = await app.request(`/${loc.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name', address: '456 Updated Ave' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New Name');
    expect(body.type).toBe('warehouse'); // unchanged
    expect(body.address).toBe('456 Updated Ave');
  });

  test('PATCH /:id returns 404 for missing location', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    expect(res.status).toBe(404);
  });

  test('DELETE /:id deletes a location', async () => {
    const loc = await seed.location({ name: 'Delete Me' });
    const res = await app.request(`/${loc.id}`, { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const getRes = await app.request(`/${loc.id}`, { headers: authHeader });
    // Location should be gone — but GET /:id doesn't exist on this route
    // Verify via list instead
    const listRes = await app.request('/', { headers: authHeader });
    expect((await listRes.json()).data).toHaveLength(0);
  });

  test('DELETE /:id returns 404 for missing location', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
