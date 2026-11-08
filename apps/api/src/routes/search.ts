import { Router } from 'express';
import type { SearchFilters, SearchRepository, SearchSort } from '../search/types.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSingleQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function getSort(value: string | undefined): SearchSort {
  return value === 'price_desc' ? 'price_desc' : 'price_asc';
}

export function createSearchRouter(repository: SearchRepository) {
  const searchRouter = Router();

  searchRouter.get('/', async (req, res) => {
    const categoryId = getSingleQueryValue(req.query.categoryId);
    const pharmacyId = getSingleQueryValue(req.query.pharmacyId);

    if (categoryId && !UUID_RE.test(categoryId)) {
      res.status(400).json({ error: 'categoryId must be a valid UUID' });
      return;
    }

    if (pharmacyId && !UUID_RE.test(pharmacyId)) {
      res.status(400).json({ error: 'pharmacyId must be a valid UUID' });
      return;
    }

    const filters: SearchFilters = {
      q: getSingleQueryValue(req.query.q),
      cp: getSingleQueryValue(req.query.cp),
      categoryId,
      pharmacyId,
      sort: getSort(getSingleQueryValue(req.query.sort))
    };

    try {
      const results = await repository.search(filters);
      res.json(results);
    } catch (error) {
      console.error('searchCompare error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return searchRouter;
}
