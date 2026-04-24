import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/orders';
import { AppDataSource } from '../src/data-source';
import { AuditLog } from '../src/entities/AuditLog';
import { User, UserRole } from '../src/entities/User';
import { generateTokens } from '../src/services/auth';

beforeAll(initTestDb);
afterAll(destroyTestDb);
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
});

async function getWarehouseAuthHeader() {
  const userRepo = AppDataSource.getRepository(User);
  const user = userRepo.create({
    email: 'warehouse@example.com',
    passwordHash: 'not-used-in-tests',
    name: 'Warehouse User',
    role: UserRole.WAREHOUSE,
  });
  await userRepo.save(user);
  const { accessToken } = generateTokens(user);
  return { Authorization: `Bearer ${accessToken}` };
}

describe('Shipping API', () => {
  test('PATCH /:id/shipping sets tracking info', async () => {
    const order = await seed.order({ externalOrderId: 'SHIP-001' });

    const res = await app.request(`/${order.id}/shipping`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber: '1Z999AA10123456784', shippingCarrier: 'ups' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackingNumber).toBe('1Z999AA10123456784');
    expect(body.shippingCarrier).toBe('ups');
  });

  test('PATCH /:id/shipping creates audit log', async () => {
    const order = await seed.order({ externalOrderId: 'SHIP-AUDIT' });

    await app.request(`/${order.id}/shipping`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber: 'TRACK-123', shippingCarrier: 'dhl' }),
    });

    const logs = await AppDataSource.getRepository(AuditLog).find();
    expect(logs).toHaveLength(1);
    expect(logs[0].entityType).toBe('order');
    expect(logs[0].entityId).toBe(order.id);
    expect(logs[0].newValues).toEqual({ trackingNumber: 'TRACK-123', shippingCarrier: 'dhl' });
  });

  test('GET /:id/tracking-url returns tracking URL for each carrier', async () => {
    const carriers = [
      { carrier: 'dhl', tracking: 'DHL-123', expected: 'https://www.dhl.com/track?id=DHL-123' },
      { carrier: 'ups', tracking: 'UPS-456', expected: 'https://www.ups.com/track?tracknum=UPS-456' },
      { carrier: 'fedex', tracking: 'FDX-789', expected: 'https://www.fedex.com/fedextrack/?trknbr=FDX-789' },
      { carrier: 'usps', tracking: 'USPS-012', expected: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=USPS-012' },
      { carrier: 'royal_mail', tracking: 'RM-345', expected: 'https://www.royalmail.com/track-your-item/?trackNumber=RM-345' },
    ];

    for (const { carrier, tracking, expected } of carriers) {
      await cleanTables();
      authHeader = await getTestAuthHeader();
      const order = await seed.order({ externalOrderId: `TRK-${carrier}` });

      await app.request(`/${order.id}/shipping`, {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: tracking, shippingCarrier: carrier }),
      });

      const res = await app.request(`/${order.id}/tracking-url`, { headers: authHeader });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.trackingUrl).toBe(expected);
      expect(body.trackingNumber).toBe(tracking);
      expect(body.shippingCarrier).toBe(carrier);
    }
  });

  test('GET /:id/tracking-url returns 404 when no tracking number', async () => {
    const order = await seed.order({ externalOrderId: 'NO-TRACK' });

    const res = await app.request(`/${order.id}/tracking-url`, { headers: authHeader });
    expect(res.status).toBe(404);
  });

  test('Warehouse user can set tracking', async () => {
    const order = await seed.order({ externalOrderId: 'WH-SHIP' });
    const warehouseHeader = await getWarehouseAuthHeader();

    const res = await app.request(`/${order.id}/shipping`, {
      method: 'PATCH',
      headers: { ...warehouseHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber: 'WH-TRACK-001', shippingCarrier: 'fedex' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackingNumber).toBe('WH-TRACK-001');
    expect(body.shippingCarrier).toBe('fedex');
  });
});
