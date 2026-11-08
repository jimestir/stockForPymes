export type SearchSort = 'price_asc' | 'price_desc';

export interface SearchFilters {
  q?: string;
  cp?: string;
  pharmacyId?: string;
  categoryId?: string;
  sort: SearchSort;
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
 * Port consumed by the HTTP layer. Sprint 3 integration will provide the
 * Prisma-backed adapter over Inventory, Product and Pharmacy.
 */
export interface SearchRepository {
  search(filters: SearchFilters): Promise<SearchResultRow[]>;
}
