import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchFilters } from '../src/search/types.js';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    inventory: {
      findMany
    }
  }
}));

import { prismaSearchRepository } from '../src/search/prisma-search-repository.js';

const baseFilters: SearchFilters = {
  sort: 'price_asc',
  limit: 20,
  offset: 0
};

const databaseRow = {
  stock: 7,
  price: 4.5,
  product: { id: 'product-1', name: 'Paracetamol 500 mg' },
  pharmacy: {
    id: 'pharmacy-1',
    name: 'Farmacia Central',
    cp: '28001',
    lat: 40.4168,
    lng: -3.7038
  }
};

beforeEach(() => {
  findMany.mockReset();
});

describe('prismaSearchRepository', () => {
  it('maps database rows to SearchResultRow', async () => {
    findMany.mockResolvedValue([databaseRow]);

    const rows = await prismaSearchRepository.search(baseFilters);

    expect(rows).toEqual([
      {
        productId: 'product-1',
        productName: 'Paracetamol 500 mg',
        pharmacyId: 'pharmacy-1',
        pharmacyName: 'Farmacia Central',
        cp: '28001',
        stock: 7,
        price: 4.5,
        lat: 40.4168,
        lng: -3.7038
      }
    ]);
  });

  it('applies filters, ordering and pagination to the query', async () => {
    findMany.mockResolvedValue([]);

    await prismaSearchRepository.search({
      q: 'para',
      cp: '28001',
      pharmacyId: '11111111-1111-4111-8111-111111111111',
      categoryId: '22222222-2222-4222-8222-222222222222',
      sort: 'price_desc',
      limit: 5,
      offset: 10
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        stock: { gte: 0 },
        pharmacyId: '11111111-1111-4111-8111-111111111111',
        pharmacy: { cp: '28001' },
        product: {
          name: { contains: 'para', mode: 'insensitive' },
          categoryId: '22222222-2222-4222-8222-222222222222'
        }
      },
      select: expect.anything(),
      orderBy: [
        { price: 'desc' },
        { pharmacy: { name: 'asc' } },
        { product: { name: 'asc' } },
        { id: 'asc' }
      ],
      skip: 10,
      take: 5
    });
  });

  it('uses price ascending and no optional filters by default', async () => {
    findMany.mockResolvedValue([]);

    await prismaSearchRepository.search(baseFilters);

    const query = findMany.mock.calls[0][0];

    expect(query.where).toEqual({ stock: { gte: 0 } });
    expect(query.orderBy[0]).toEqual({ price: 'asc' });
    expect(query.skip).toBe(0);
    expect(query.take).toBe(20);
  });
});
