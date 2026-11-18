import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  SearchFilters,
  SearchRepository,
  SearchResultRow
} from './types.js';

function buildWhere(filters: SearchFilters): Prisma.InventoryWhereInput {
  const where: Prisma.InventoryWhereInput = {
    // The database enforces CHECK (stock >= 0); keeping the filter explicit
    // documents that out-of-stock rows are part of the comparison results.
    stock: { gte: 0 }
  };

  if (filters.pharmacyId) {
    where.pharmacyId = filters.pharmacyId;
  }

  if (filters.cp) {
    where.pharmacy = { cp: filters.cp };
  }

  if (filters.q || filters.categoryId) {
    where.product = {
      ...(filters.q
        ? { name: { contains: filters.q, mode: 'insensitive' } }
        : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {})
    };
  }

  return where;
}

export const prismaSearchRepository: SearchRepository = {
  async search(filters: SearchFilters): Promise<SearchResultRow[]> {
    const priceOrder = filters.sort === 'price_desc' ? 'desc' : 'asc';

    const rows = await prisma.inventory.findMany({
      where: buildWhere(filters),
      select: {
        stock: true,
        price: true,
        product: {
          select: { id: true, name: true }
        },
        pharmacy: {
          select: { id: true, name: true, cp: true, lat: true, lng: true }
        }
      },
      // The extra keys keep pagination stable when several rows share a price.
      orderBy: [
        { price: priceOrder },
        { pharmacy: { name: 'asc' } },
        { product: { name: 'asc' } },
        { id: 'asc' }
      ],
      skip: filters.offset,
      take: filters.limit
    });

    return rows.map((row) => ({
      productId: row.product.id,
      productName: row.product.name,
      pharmacyId: row.pharmacy.id,
      pharmacyName: row.pharmacy.name,
      cp: row.pharmacy.cp,
      stock: row.stock,
      price: Number(row.price),
      lat: row.pharmacy.lat,
      lng: row.pharmacy.lng
    }));
  }
};
