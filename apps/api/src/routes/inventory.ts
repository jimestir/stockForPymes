import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  inventoryUpsertSchema,
  type InventoryUpsertInput
} from '../schemas/inventory.js';

export const inventoryRouter = Router();

const inventorySelect = {
  id: true,
  pharmacyId: true,
  productId: true,
  stock: true,
  price: true,
  version: true,
  updatedAt: true
} as const;

const uuidSchema = z.uuid();

function toInventoryItem(row: {
  id: string;
  pharmacyId: string;
  productId: string;
  stock: number;
  price: Prisma.Decimal;
  version: number;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    pharmacyId: row.pharmacyId,
    productId: row.productId,
    stock: row.stock,
    price: Number(row.price),
    version: row.version,
    updatedAt: row.updatedAt.toISOString()
  };
}

// Endpoint GET(/) -> listado de inventario
inventoryRouter.get(
  '/',
  requireAuth,
  requireRole('PHARMACY', 'ADMIN'),
  async (req, res) => {
    const user = req.user!;

    try {
      if (user.role === 'PHARMACY' && !user.pharmacyId) {
        res
          .status(403)
          .json({ error: 'Pharmacy account is not linked to a pharmacy' });
        return;
      }

      const adminPharmacyId =
        user.role === 'ADMIN' && typeof req.query.pharmacyId === 'string'
          ? req.query.pharmacyId.trim()
          : undefined;

      if (adminPharmacyId && !uuidSchema.safeParse(adminPharmacyId).success) {
        res.status(400).json({ error: 'pharmacyId must be a valid UUID' });
        return;
      }

      const pharmacyId =
        user.role === 'ADMIN' ? adminPharmacyId : user.pharmacyId ?? undefined;

      if (!pharmacyId) {
        res.status(400).json({ error: 'pharmacyId is required for admin' });
        return;
      }

      const rows = await prisma.inventory.findMany({
        where: { pharmacyId },
        select: inventorySelect,
        orderBy: { updatedAt: 'desc' }
      });

      res.json(rows.map(toInventoryItem));
    } catch (error) {
      console.error('listInventory error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Endpoint PUT(/) -> Actualiza o crea Stock/Precio
inventoryRouter.put(
  '/',
  requireAuth,
  requireRole('PHARMACY'),
  validateBody(inventoryUpsertSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as InventoryUpsertInput;

    try {
      if (!user.pharmacyId) {
        res
          .status(403)
          .json({ error: 'Pharmacy account is not linked to a pharmacy' });
        return;
      }

      const product = await prisma.product.findUnique({
        where: { id: body.productId },
        select: { id: true }
      });

      if (!product) {
        res.status(400).json({ error: 'Product not found' });
        return;
      }

      const row = await prisma.inventory.upsert({
        where: {
          pharmacyId_productId: {
            pharmacyId: user.pharmacyId,
            productId: body.productId
          }
        },
        create: {
          pharmacyId: user.pharmacyId,
          productId: body.productId,
          stock: body.stock,
          price: body.price,
          version: 1
        },
        update: {
          stock: body.stock,
          price: body.price,
          version: { increment: 1 }
        },
        select: inventorySelect
      });

      res.json(toInventoryItem(row));
    } catch (error) {
      console.error('upsertInventory error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
