import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { SearchResultRow } from '../src/search/types.js';

const results: SearchResultRow[] = [
  {
    productId: '33333333-3333-4333-8333-333333333333',
    productName: 'Paracetamol 500 mg',
    pharmacyId: '11111111-1111-4111-8111-111111111111',
    pharmacyName: 'Farmacia Central',
    cp: '28001',
    stock: 12,
    price: 4.5,
    lat: 40.4168,
    lng: -3.7038
  }
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createApp', () => {
  it('mounts GET /api/search with the injected repository', async () => {
    const search = vi.fn(async () => results);
    const app = createApp({ searchRepository: { search } });

    const response = await request(app)
      .get('/api/search')
      .query({ limit: '1' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(results);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1, offset: 0 })
    );
  });

  it('keeps the 404 fallback for unknown routes', async () => {
    const search = vi.fn(async () => results);
    const app = createApp({ searchRepository: { search } });

    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });
});
