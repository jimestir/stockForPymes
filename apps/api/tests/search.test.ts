import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSearchRouter } from '../src/routes/search.js';
import type {
  SearchFilters,
  SearchRepository,
  SearchResultRow
} from '../src/search/types.js';

const pharmacyId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

const results: SearchResultRow[] = [
  {
    productId: '33333333-3333-4333-8333-333333333333',
    productName: 'Paracetamol 500 mg',
    pharmacyId,
    pharmacyName: 'Farmacia Central',
    cp: '28001',
    stock: 0,
    price: 4.5,
    lat: 40.4168,
    lng: -3.7038
  }
];

function createTestApp(search: SearchRepository['search']) {
  const app = express();
  app.use('/api/search', createSearchRouter({ search }));
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/search', () => {
  it('returns 200 and preserves rows supplied by the repository, including stock zero', async () => {
    const search = vi.fn(async (_filters: SearchFilters) => results);
    const response = await request(createTestApp(search)).get('/api/search');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(results);
    expect(search).toHaveBeenCalledWith({
      q: undefined,
      cp: undefined,
      pharmacyId: undefined,
      categoryId: undefined,
      sort: 'price_asc'
    });
  });

  it('normalizes text filters and forwards combined filters to the repository', async () => {
    const search = vi.fn(async (_filters: SearchFilters) => results);
    const response = await request(createTestApp(search))
      .get('/api/search')
      .query({
        q: '  paraCETAMOL  ',
        cp: ' 28001 ',
        pharmacyId,
        categoryId,
        sort: 'price_desc'
      });

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith({
      q: 'paraCETAMOL',
      cp: '28001',
      pharmacyId,
      categoryId,
      sort: 'price_desc'
    });
  });

  it('normalizes empty text filters to undefined', async () => {
    const search = vi.fn(async (_filters: SearchFilters) => []);
    const response = await request(createTestApp(search))
      .get('/api/search')
      .query({ q: '   ', cp: '' });

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith({
      q: undefined,
      cp: undefined,
      pharmacyId: undefined,
      categoryId: undefined,
      sort: 'price_asc'
    });
  });

  it('uses price_asc for an omitted or unsupported sort value', async () => {
    const defaultSearch = vi.fn(async (_filters: SearchFilters) => []);
    const invalidSearch = vi.fn(async (_filters: SearchFilters) => []);

    await request(createTestApp(defaultSearch)).get('/api/search');
    await request(createTestApp(invalidSearch)).get('/api/search').query({ sort: 'name_asc' });

    expect(defaultSearch).toHaveBeenCalledWith(expect.objectContaining({ sort: 'price_asc' }));
    expect(invalidSearch).toHaveBeenCalledWith(expect.objectContaining({ sort: 'price_asc' }));
  });

  it.each([
    ['pharmacyId', 'not-a-uuid', 'pharmacyId must be a valid UUID'],
    ['categoryId', 'not-a-uuid', 'categoryId must be a valid UUID']
  ])('returns 400 for an invalid %s and does not call the repository', async (key, value, error) => {
    const search = vi.fn(async (_filters: SearchFilters) => results);
    const response = await request(createTestApp(search)).get('/api/search').query({ [key]: value });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
    expect(search).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository fails unexpectedly', async () => {
    const search = vi.fn(async (_filters: SearchFilters) => {
      throw new Error('database unavailable');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await request(createTestApp(search)).get('/api/search');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(errorSpy).toHaveBeenCalled();
  });
});
