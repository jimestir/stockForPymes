import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const productsRouter = Router();

const productSelect = {
  id: true,
  name: true,
  description: true,
  categoryId: true
} as const;

const uuidSchema = z.uuid();

// Endpoint GET(/) -> Lita y Filtra los productos
productsRouter.get('/', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const categoryId =
      typeof req.query.categoryId === 'string'
        ? req.query.categoryId.trim()
        : undefined;

    if (categoryId && !uuidSchema.safeParse(categoryId).success) {
      res.status(400).json({ error: 'categoryId must be a valid UUID' });
      return;
    }

    const products = await prisma.product.findMany({
      where: {
        AND: [
          q ? { name: { contains: q, mode: 'insensitive' } } : {},
          categoryId ? { categoryId } : {}
        ]
      },
      select: productSelect,
      orderBy: { name: 'asc' }
    });

    res.json(products);
  } catch (error) {
    console.error('listProducts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
