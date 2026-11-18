export type SearchSort = 'price_asc' | 'price_desc';

export interface SearchFilters {
  q?: string;
  cp?: string;
  pharmacyId?: string;
  categoryId?: string;
  sort: SearchSort;
  limit: number;
  offset: number;
}

export interface SearchResultRow {
  productId: string;
  productName: string;
  pharmacyId: string;
  pharmacyName: string;
  cp: string;
  stock: number;
  price: number;
  lat: number | null;
  lng: number | null;
}

/**
 * Port consumed by the HTTP layer. The Prisma-backed adapter lives in
 * `prisma-search-repository.ts` and queries Inventory joined with Product and
 * Pharmacy.
 */
export interface SearchRepository {
  search(filters: SearchFilters): Promise<SearchResultRow[]>;
}
