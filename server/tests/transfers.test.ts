import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/transfers';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { Transfer, TransferStatus } from '../src/entities/Transfer';
import { TransferItem } from '../src/entities/TransferItem';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Transfers API', () => {
  // ─── GET / ──────────────────────────────────────────────────────────

  test('GET / returns empty array when no transfers', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('GET / returns transfers with relations', async () => {
    const locA = await seed.location({ name: 'Warehouse A' });
    const locB = await seed.location({ name: 'Warehouse B' });
    const { variants } = await seed.product({ name: 'Transferred Item', sku: 'TI-001' });
    const variant = variants[0];

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variant.id, quantity: 10 }],
      }),
    });
    expect(res.status).toBe(201);

    const listRes = await app.request('/', { headers: authHeader });
    expect(listRes.status).toBe(200);
    const body = await listRes.json();
    expect(body.data).toHaveLength(1);

    const transfer = body.data[0];
    expect(transfer.id).toBeDefined();
    expect(transfer.status).toBe('draft');
    expect(transfer.fromLocation).toBeDefined();
    expect(transfer.fromLocation.name).toBe('Warehouse A');
    expect(transfer.toLocation).toBeDefined();
    expect(transfer.toLocation.name).toBe('Warehouse B');
    expect(transfer.items).toBeDefined();
    expect(transfer.items).toHaveLength(1);
    expect(transfer.items[0].quantity).toBe(10);
    expect(transfer.items[0].variant).toBeDefined();
  });

  test('GET / filters by status', async () => {
    const locA = await seed.location({ name: 'Src' });
    const locB = await seed.location({ name: 'Dst' });
    const { variants } = await seed.product({ sku: 'FILT-001' });

    // Create two transfers, one draft, one in_transit
    const t1 = await AppDataSource.getRepository(Transfer).save(
      AppDataSource.getRepository(Transfer).create({
        fromLocationId: locA.id, toLocationId: locB.id, status: TransferStatus.DRAFT,
      })
    );
    const t2 = await AppDataSource.getRepository(Transfer).save(
      AppDataSource.getRepository(Transfer).create({
        fromLocationId: locA.id, toLocationId: locB.id, status: TransferStatus.IN_TRANSIT,
      })
    );

    const draftRes = await app.request('/?status=draft', { headers: authHeader });
    expect(draftRes.status).toBe(200);
    const draftBody = await draftRes.json();
    expect(draftBody.data).toHaveLength(1);
    expect(draftBody.data[0].id).toBe(t1.id);

    const transitRes = await app.request('/?status=in_transit', { headers: authHeader });
    expect(transitRes.status).toBe(200);
    const transitBody = await transitRes.json();
    expect(transitBody.data).toHaveLength(1);
    expect(transitBody.data[0].id).toBe(t2.id);
  });

  // ─── POST / ─────────────────────────────────────────────────────────

  test('POST / creates a transfer with items', async () => {
    const locA = await seed.location({ name: 'Source' });
    const locB = await seed.location({ name: 'Destination' });
    const { variants } = await seed.product({ name: 'Widget', sku: 'W-100' });
    const variant = variants[0];

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        notes: 'Urgent restock',
        items: [{ variantId: variant.id, quantity: 5 }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('draft');
    expect(body.fromLocationId).toBe(locA.id);
    expect(body.toLocationId).toBe(locB.id);
    expect(body.notes).toBe('Urgent restock');
    expect(body.items).toBeDefined();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].variantId).toBe(variant.id);
    expect(body.items[0].quantity).toBe(5);
  });

  test('POST / rejects same source and destination (400)', async () => {
    const loc = await seed.location({ name: 'Same' });
    const { variants } = await seed.product({ sku: 'SAME-001' });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: loc.id,
        toLocationId: loc.id,
        items: [{ variantId: variants[0].id, quantity: 1 }],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/different/i);
  });

  test('POST / rejects insufficient stock (400)', async () => {
    const locA = await seed.location({ name: 'LowSrc' });
    const locB = await seed.location({ name: 'Dest' });
    const { variants } = await seed.product({ sku: 'LOW-001' });

    // Set inventory to 3
    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    await AppDataSource.getRepository(InventoryLevel).update(levels[0].id, { quantity: 3 });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variants[0].id, quantity: 10 }],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/insufficient/i);
  });

  test('POST / rejects empty items array (400)', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  // ─── GET /:id ───────────────────────────────────────────────────────

  test('GET /:id returns 404 for missing transfer', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  // ─── PATCH /:id/status ─────────────────────────────────────────────

  test('PATCH /:id/status transitions draft → in_transit', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });
    const { variants } = await seed.product({ sku: 'TR-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variants[0].id, quantity: 5 }],
      }),
    });
    const transfer = await createRes.json();
    expect(transfer.status).toBe('draft');

    const res = await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('in_transit');
  });

  test('PATCH /:id/status transitions in_transit → completed and updates inventory', async () => {
    const locA = await seed.location({ name: 'Source' });
    const locB = await seed.location({ name: 'Dest' });
    const { variants } = await seed.product({ sku: 'CMP-001' });
    const variant = variants[0];

    // Create transfer
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variant.id, quantity: 20 }],
      }),
    });
    const transfer = await createRes.json();

    // Move to in_transit
    await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' }),
    });

    // Complete transfer
    const res = await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(body.completedAt).toBeDefined();

    // Check inventory: source should be 100 - 20 = 80, dest should be 100 + 20 = 120
    const srcLevel = await AppDataSource.getRepository(InventoryLevel).findOne({
      where: { variantId: variant.id, locationId: locA.id },
    });
    expect(srcLevel!.quantity).toBe(80);

    const dstLevel = await AppDataSource.getRepository(InventoryLevel).findOne({
      where: { variantId: variant.id, locationId: locB.id },
    });
    expect(dstLevel!.quantity).toBe(120);

    // Verify audit logs created
    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const transferLogs = logs.filter(l => l.action === AuditAction.TRANSFER_COMPLETED);
    expect(transferLogs).toHaveLength(1);
  });

  test('PATCH /:id/status transitions any → cancelled and creates audit log', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });
    const { variants } = await seed.product({ sku: 'CAN-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variants[0].id, quantity: 5 }],
      }),
    });
    const transfer = await createRes.json();

    const res = await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('cancelled');

    // Verify audit log
    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AuditAction.TRANSFER_CANCELLED);
    expect(logs[0].entityType).toBe('transfer');
    expect(logs[0].entityId).toBe(transfer.id);
  });

  test('PATCH /:id/status rejects invalid transition (400)', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });
    const { variants } = await seed.product({ sku: 'INV-001' });

    // Create as draft
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variants[0].id, quantity: 5 }],
      }),
    });
    const transfer = await createRes.json();

    // Try to go draft → completed (should be rejected)
    const res = await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/invalid transition/i);
  });

  test('PATCH /:id/status rejects transition from completed (400)', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });
    const { variants } = await seed.product({ sku: 'DONE-001' });

    const transfer = await AppDataSource.getRepository(Transfer).save(
      AppDataSource.getRepository(Transfer).create({
        fromLocationId: locA.id, toLocationId: locB.id, status: TransferStatus.COMPLETED,
      })
    );

    const res = await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /:id/status returns 404 for missing transfer', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000/status', {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' }),
    });
    expect(res.status).toBe(404);
  });

  // ─── DELETE /:id ────────────────────────────────────────────────────

  test('DELETE /:id deletes a draft transfer', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });
    const { variants } = await seed.product({ sku: 'DEL-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variants[0].id, quantity: 5 }],
      }),
    });
    const transfer = await createRes.json();

    const delRes = await app.request(`/${transfer.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).message).toMatch(/deleted/i);

    // Verify it's gone
    const remaining = await AppDataSource.getRepository(Transfer).find();
    expect(remaining).toHaveLength(0);

    // Verify items also deleted (cascade)
    const remainingItems = await AppDataSource.getRepository(TransferItem).find();
    expect(remainingItems).toHaveLength(0);
  });

  test('DELETE /:id rejects deleting non-draft transfer (400)', async () => {
    const locA = await seed.location({ name: 'A' });
    const locB = await seed.location({ name: 'B' });
    const { variants } = await seed.product({ sku: 'NODEL-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLocationId: locA.id,
        toLocationId: locB.id,
        items: [{ variantId: variants[0].id, quantity: 5 }],
      }),
    });
    const transfer = await createRes.json();

    // Move to in_transit
    await app.request(`/${transfer.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' }),
    });

    // Try to delete
    const delRes = await app.request(`/${transfer.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(delRes.status).toBe(400);
    expect((await delRes.json()).error.message).toMatch(/draft/i);
  });

  test('DELETE /:id returns 404 for missing transfer', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
