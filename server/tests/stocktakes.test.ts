import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/stocktakes';
import { AppDataSource } from '../src/data-source';
import { InventoryLevel } from '../src/entities/InventoryLevel';
import { Stocktake, StocktakeStatus } from '../src/entities/Stocktake';
import { StocktakeItem } from '../src/entities/StocktakeItem';
import { StockAdjustment, AdjustmentReason } from '../src/entities/StockAdjustment';
import { AuditLog, AuditAction } from '../src/entities/AuditLog';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

describe('Stocktakes API', () => {
  // ─── GET / ──────────────────────────────────────────────────────────

  test('GET / returns empty array when no stocktakes', async () => {
    const res = await app.request('/', { headers: authHeader });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test('GET / returns stocktakes with relations', async () => {
    const loc = await seed.location({ name: 'Stocktake WH' });
    const { product, variants } = await seed.product({ name: 'Countable Item', sku: 'CI-001' });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id, notes: 'Monthly count' }),
    });
    expect(res.status).toBe(201);

    const listRes = await app.request('/', { headers: authHeader });
    expect(listRes.status).toBe(200);
    const body = await listRes.json();
    expect(body.data).toHaveLength(1);

    const stocktake = body.data[0];
    expect(stocktake.id).toBeDefined();
    expect(stocktake.status).toBe('draft');
    expect(stocktake.location).toBeDefined();
    expect(stocktake.location.name).toBe('Stocktake WH');
    expect(stocktake.notes).toBe('Monthly count');
    expect(stocktake.items).toBeDefined();
    expect(stocktake.items.length).toBeGreaterThan(0);
  });

  test('GET / filters by status', async () => {
    const loc = await seed.location({ name: 'Filter WH' });
    await seed.product({ sku: 'FLT-001' });

    const draftRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const draftStocktake = await draftRes.json();

    // Move one to in_progress
    const inProgressRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const inProgressStocktake = await inProgressRes.json();

    await app.request(`/${inProgressStocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    const draftList = await app.request('/?status=draft', { headers: authHeader });
    expect((await draftList.json()).data).toHaveLength(1);

    const ipList = await app.request('/?status=in_progress', { headers: authHeader });
    expect((await ipList.json()).data).toHaveLength(1);
  });

  // ─── POST / ─────────────────────────────────────────────────────────

  test('POST / creates a stocktake with items from current inventory', async () => {
    const loc = await seed.location({ name: 'Count WH' });
    const { product, variants } = await seed.product({ name: 'Item A', sku: 'IA-001' });
    const variant = variants[0];

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id, notes: 'Quarterly check' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.id).toBeDefined();
    expect(body.status).toBe('draft');
    expect(body.locationId).toBe(loc.id);
    expect(body.notes).toBe('Quarterly check');
    expect(body.items).toBeDefined();
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    expect(item.variantId).toBe(variant.id);
    expect(item.systemQuantity).toBe(100);
    expect(item.countedQuantity).toBeNull();
    expect(item.discrepancy).toBeNull();
  });

  test('POST / creates stocktake items for all variants at the location', async () => {
    const loc = await seed.location({ name: 'Multi WH' });
    const { variants: v1 } = await seed.product({ name: 'Product A', sku: 'PA-001' });
    const { variants: v2 } = await seed.product({ name: 'Product B', sku: 'PB-002' });

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();

    // Each product creates 1 variant, so 2 stocktake items
    expect(body.items).toHaveLength(2);
  });

  test('POST / for location with no inventory creates stocktake with no items', async () => {
    const loc = await seed.location({ name: 'Empty WH' });
    // No products seeded, so no inventory at this location

    const res = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });

  // ─── GET /:id ───────────────────────────────────────────────────────

  test('GET /:id returns 404 for missing stocktake', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', { headers: authHeader });
    expect(res.status).toBe(404);
  });

  // ─── PATCH /:id/status ─────────────────────────────────────────────

  test('PATCH /:id/status transitions draft → in_progress', async () => {
    const loc = await seed.location({ name: 'A' });
    await seed.product({ sku: 'S1-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();
    expect(stocktake.status).toBe('draft');

    const res = await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('in_progress');
  });

  test('PATCH /:id/status rejects non-draft → in_progress (400)', async () => {
    const loc = await seed.location({ name: 'A' });
    await seed.product({ sku: 'S2-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();

    // Move to in_progress
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    // Try to set in_progress again
    const res = await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/only draft/i);
  });

  test('PATCH /:id/status transitions in_progress → completed and adjusts inventory', async () => {
    const loc = await seed.location({ name: 'Complete WH' });
    const { variants } = await seed.product({ sku: 'SC-001' });
    const variant = variants[0];

    // Create stocktake
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();
    const stocktakeItem = stocktake.items[0];

    // Start stocktake
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    // Update counted quantity to 80 (system was 100)
    await app.request(`/${stocktake.id}/items/${stocktakeItem.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 80 }),
    });

    // Complete stocktake
    const res = await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(body.completedAt).toBeDefined();

    // Check inventory updated: system was 100, counted 80, so now 80
    const level = await AppDataSource.getRepository(InventoryLevel).findOne({
      where: { variantId: variant.id, locationId: loc.id },
    });
    expect(level!.quantity).toBe(80);

    // Check StockAdjustment created for discrepancy
    const adjustments = await AppDataSource.getRepository(StockAdjustment).find();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].quantityChange).toBe(-20);
    expect(adjustments[0].previousQuantity).toBe(100);
    expect(adjustments[0].newQuantity).toBe(80);
    expect(adjustments[0].reason).toBe(AdjustmentReason.STOCKTAKE);

    // Check audit log for the adjustment
    const logs = await AppDataSource.getRepository(AuditLog).find();
    const adjustLog = logs.find(l => l.action === AuditAction.ADJUST_STOCK);
    expect(adjustLog).toBeDefined();
    expect(adjustLog!.entityType).toBe('inventory');

    // Check overall stocktake completed audit log
    const stocktakeLog = logs.find(l => l.action === AuditAction.STOCKTAKE_COMPLETED);
    expect(stocktakeLog).toBeDefined();
    expect(stocktakeLog!.entityType).toBe('stocktake');
    expect(stocktakeLog!.newValues).toHaveProperty('totalDiscrepancies', 1);
  });

  test('PATCH /:id/status completed with no discrepancies does not adjust inventory', async () => {
    const loc = await seed.location({ name: 'Perfect WH' });
    const { variants } = await seed.product({ sku: 'SP-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();
    const stocktakeItem = stocktake.items[0];

    // Start
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    // Count matches system (100)
    await app.request(`/${stocktake.id}/items/${stocktakeItem.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 100 }),
    });

    // Complete
    const res = await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);

    // Inventory unchanged
    const levels = await AppDataSource.getRepository(InventoryLevel).find();
    expect(levels[0].quantity).toBe(100);

    // No stock adjustment created (discrepancy = 0)
    const adjustments = await AppDataSource.getRepository(StockAdjustment).find();
    expect(adjustments).toHaveLength(0);
  });

  test('PATCH /:id/status completed with positive discrepancy (more stock than expected)', async () => {
    const loc = await seed.location({ name: 'Surplus WH' });
    const { variants } = await seed.product({ sku: 'SS-001' });
    const variant = variants[0];

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();
    const stocktakeItem = stocktake.items[0];

    // Start
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    // Count 120 (system was 100) — found 20 extra
    await app.request(`/${stocktake.id}/items/${stocktakeItem.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 120 }),
    });

    // Complete
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });

    // Inventory updated to 120
    const level = await AppDataSource.getRepository(InventoryLevel).findOne({
      where: { variantId: variant.id, locationId: loc.id },
    });
    expect(level!.quantity).toBe(120);

    // Stock adjustment with +20
    const adjustments = await AppDataSource.getRepository(StockAdjustment).find();
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].quantityChange).toBe(20);
    expect(adjustments[0].previousQuantity).toBe(100);
    expect(adjustments[0].newQuantity).toBe(120);
  });

  test('PATCH /:id/status rejects draft → completed (400)', async () => {
    const loc = await seed.location({ name: 'A' });
    await seed.product({ sku: 'S3-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();

    const res = await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/only in-progress/i);
  });

  test('PATCH /:id/status returns 404 for missing stocktake', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000/status', {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    expect(res.status).toBe(404);
  });

  // ─── PATCH /:id/items/:itemId ───────────────────────────────────────

  test('PATCH /:id/items/:itemId updates counted quantity', async () => {
    const loc = await seed.location({ name: 'Update WH' });
    await seed.product({ sku: 'SU-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();
    const item = stocktake.items[0];

    // Start stocktake
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    // Update counted quantity
    const res = await app.request(`/${stocktake.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 75, notes: 'Found 25 damaged' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.countedQuantity).toBe(75);
    expect(body.discrepancy).toBe(-25); // 75 - 100
    expect(body.notes).toBe('Found 25 damaged');
    expect(body.systemQuantity).toBe(100);

    // Verify persisted
    const dbItem = await AppDataSource.getRepository(StocktakeItem).findOne({ where: { id: item.id } });
    expect(dbItem!.countedQuantity).toBe(75);
    expect(dbItem!.discrepancy).toBe(-25);
  });

  test('PATCH /:id/items/:itemId rejects update on non-in_progress stocktake (400)', async () => {
    const loc = await seed.location({ name: 'Draft WH' });
    await seed.product({ sku: 'SD-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();
    const item = stocktake.items[0];

    // Try to update item while still in draft
    const res = await app.request(`/${stocktake.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 50 }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/in-progress/i);
  });

  test('PATCH /:id/items/:itemId returns 404 for missing stocktake', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000/items/some-item-id', {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 50 }),
    });
    expect(res.status).toBe(404);
  });

  test('PATCH /:id/items/:itemId returns 404 for missing item', async () => {
    const loc = await seed.location({ name: 'A' });
    await seed.product({ sku: 'SI-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();

    // Start stocktake
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    const res = await app.request(`/${stocktake.id}/items/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedQuantity: 50 }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toMatch(/stocktake item not found/i);
  });

  // ─── DELETE /:id ────────────────────────────────────────────────────

  test('DELETE /:id deletes a draft stocktake', async () => {
    const loc = await seed.location({ name: 'Del WH' });
    await seed.product({ sku: 'SDL-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();

    const delRes = await app.request(`/${stocktake.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).message).toMatch(/deleted/i);

    const remaining = await AppDataSource.getRepository(Stocktake).find();
    expect(remaining).toHaveLength(0);

    const remainingItems = await AppDataSource.getRepository(StocktakeItem).find();
    expect(remainingItems).toHaveLength(0);
  });

  test('DELETE /:id rejects deleting non-draft stocktake (400)', async () => {
    const loc = await seed.location({ name: 'NoDel WH' });
    await seed.product({ sku: 'SND-001' });

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const stocktake = await createRes.json();

    // Move to in_progress
    await app.request(`/${stocktake.id}/status`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    const delRes = await app.request(`/${stocktake.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(delRes.status).toBe(400);
    expect((await delRes.json()).error.message).toMatch(/draft/i);
  });

  test('DELETE /:id returns 404 for missing stocktake', async () => {
    const res = await app.request('/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
