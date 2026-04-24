import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { initTestDb, destroyTestDb, cleanTables, seed, getTestAuthHeader } from './setup';
import app from '../src/routes/products';
import path from 'node:path';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const TEST_UPLOADS_DIR = path.join(process.cwd(), 'uploads');

beforeAll(async () => {
  await initTestDb();
  if (!existsSync(TEST_UPLOADS_DIR)) {
    await mkdir(TEST_UPLOADS_DIR, { recursive: true });
  }
});
afterAll(async () => {
  await destroyTestDb();
});
let authHeader: Record<string, string>;
beforeEach(async () => {
  await cleanTables();
  authHeader = await getTestAuthHeader();
  const files = await readdir(TEST_UPLOADS_DIR);
  for (const f of files.filter((f) => f.startsWith('product-'))) {
    await rm(path.join(TEST_UPLOADS_DIR, f));
  }
});

function createTestImageBuffer(type: string = 'image/png') {
  return new File([new ArrayBuffer(100)], 'test.png', { type });
}

describe('Product Images API', () => {
  test('POST /:id/images uploads an image', async () => {
    const { product } = await seed.product({ name: 'ImgTest', sku: 'IMG-001' });

    const formData = new FormData();
    formData.append('file', createTestImageBuffer());

    const res = await app.request(`/${product.id}/images`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.image).toMatch(/^\/uploads\/product-.*\.png$/);
  });

  test('POST /:id/images rejects non-image file', async () => {
    const { product } = await seed.product({ name: 'RejectTest', sku: 'REJ-001' });

    const formData = new FormData();
    formData.append('file', new File([new ArrayBuffer(100)], 'test.txt', { type: 'text/plain' }));

    const res = await app.request(`/${product.id}/images`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });
    expect(res.status).toBe(400);
  });

  test('POST /:id/images rejects file exceeding 5MB', async () => {
    const { product } = await seed.product({ name: 'BigTest', sku: 'BIG-001' });

    const bigBuffer = new ArrayBuffer(6 * 1024 * 1024);
    const formData = new FormData();
    formData.append('file', new File([bigBuffer], 'big.png', { type: 'image/png' }));

    const res = await app.request(`/${product.id}/images`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });
    expect(res.status).toBe(400);
  });

  test('POST /:id/images returns 404 for missing product', async () => {
    const formData = new FormData();
    formData.append('file', createTestImageBuffer());

    const res = await app.request('/00000000-0000-0000-0000-000000000000/images', {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });
    expect(res.status).toBe(404);
  });

  test('GET /:id/images returns images array', async () => {
    const { product } = await seed.product({ name: 'GetImg', sku: 'GI-001' });

    const formData = new FormData();
    formData.append('file', createTestImageBuffer());

    await app.request(`/${product.id}/images`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });

    const res = await app.request(`/${product.id}/images`, { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(1);
    expect(body.images[0]).toMatch(/^\/uploads\//);
  });

  test('DELETE /:id/images/:index removes image', async () => {
    const { product } = await seed.product({ name: 'DelImg', sku: 'DI-001' });

    const formData = new FormData();
    formData.append('file', createTestImageBuffer());

    await app.request(`/${product.id}/images`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });

    const res = await app.request(`/${product.id}/images/0`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(200);

    const getRes = await app.request(`/${product.id}/images`, { headers: authHeader });
    const body = await getRes.json();
    expect(body.images).toHaveLength(0);
  });

  test('DELETE /:id/images/:index returns 400 for invalid index', async () => {
    const { product } = await seed.product({ name: 'BadIdx', sku: 'BI-001' });

    const res = await app.request(`/${product.id}/images/99`, {
      method: 'DELETE',
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  test('multiple images can be uploaded', async () => {
    const { product } = await seed.product({ name: 'MultiImg', sku: 'MI-001' });

    for (let i = 0; i < 3; i++) {
      const formData = new FormData();
      formData.append('file', createTestImageBuffer());
      await app.request(`/${product.id}/images`, {
        method: 'POST',
        headers: authHeader,
        body: formData,
      });
    }

    const res = await app.request(`/${product.id}/images`, { headers: authHeader });
    const body = await res.json();
    expect(body.images).toHaveLength(3);
  });
});
