import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type {
  ReservationGroupStatus,
  ReservationStatus
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { deriveGroupStatus, isActive } from '../reservations/status.js';
import {
  reservationGroupCancelSchema,
  reservationGroupCreateSchema,
  reservationGroupPickupSchema,
  type ReservationGroupCancelInput,
  type ReservationGroupCreateInput,
  type ReservationGroupPickupInput
} from '../schemas/reservation.js';

export const reservationsRouter = Router();

const RESERVATION_TTL_MS = 30 * 60 * 1000;

const itemSelect = {
  id: true,
  groupId: true,
  userId: true,
  pharmacyId: true,
  productId: true,
  quantity: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  product: { select: { name: true } },
  pharmacy: { select: { name: true } },
  user: { select: { name: true, email: true, phone: true } }
} as const;

const groupSelect = {
  id: true,
  userId: true,
  pharmacyId: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  pharmacy: { select: { name: true } },
  user: { select: { name: true, email: true, phone: true } },
  items: {
    select: itemSelect,
    orderBy: { createdAt: 'asc' as const }
  }
} as const;

type InventoryLockRow = {
  id: string;
  stock: number;
  version: number;
};

type ItemRow = {
  id: string;
  groupId: string;
  userId: string;
  pharmacyId: string;
  productId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  product?: { name: string } | null;
  pharmacy?: { name: string } | null;
  user?: { name: string; email: string; phone: string | null } | null;
};

type GroupRow = {
  id: string;
  userId: string;
  pharmacyId: string;
  status: ReservationGroupStatus;
  expiresAt: Date;
  createdAt: Date;
  pharmacy?: { name: string } | null;
  user?: { name: string; email: string; phone: string | null } | null;
  items: ItemRow[];
};

function toItem(row: ItemRow) {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    pharmacyId: row.pharmacyId,
    productId: row.productId,
    productName: row.product?.name ?? null,
    pharmacyName: row.pharmacy?.name ?? null,
    clientName: row.user?.name ?? null,
    clientEmail: row.user?.email ?? null,
    clientPhone: row.user?.phone ?? null,
    quantity: row.quantity,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

function toGroup(row: GroupRow) {
  const items = row.items.map(toItem);
  return {
    id: row.id,
    userId: row.userId,
    pharmacyId: row.pharmacyId,
    pharmacyName: row.pharmacy?.name ?? null,
    clientName: row.user?.name ?? null,
    clientEmail: row.user?.email ?? null,
    clientPhone: row.user?.phone ?? null,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    itemCount: items.length,
    items
  };
}

async function restoreStock(
  tx: Prisma.TransactionClient,
  pharmacyId: string,
  productId: string,
  quantity: number
) {
  const locked = await tx.$queryRaw<InventoryLockRow[]>`
    SELECT id, stock, version
    FROM inventory
    WHERE pharmacy_id = ${pharmacyId}::uuid
      AND product_id = ${productId}::uuid
    FOR UPDATE
  `;

  const inventory = locked[0];
  if (!inventory) {
    return;
  }

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      stock: inventory.stock + quantity,
      version: { increment: 1 }
    }
  });
}

async function deductStock(
  tx: Prisma.TransactionClient,
  pharmacyId: string,
  productId: string,
  quantity: number
) {
  const locked = await tx.$queryRaw<InventoryLockRow[]>`
    SELECT id, stock, version
    FROM inventory
    WHERE pharmacy_id = ${pharmacyId}::uuid
      AND product_id = ${productId}::uuid
    FOR UPDATE
  `;

  const inventory = locked[0];
  if (!inventory) {
    throw Object.assign(new Error('Inventory not found'), {
      code: 'NOT_FOUND'
    });
  }

  if (inventory.stock < quantity) {
    throw Object.assign(new Error('Insufficient stock'), {
      code: 'CONFLICT'
    });
  }

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      stock: inventory.stock - quantity,
      version: { increment: 1 }
    }
  });
}

async function refreshGroupStatus(
  tx: Prisma.TransactionClient,
  groupId: string
) {
  const items = await tx.reservation.findMany({
    where: { groupId },
    select: { status: true }
  });

  return tx.reservationGroup.update({
    where: { id: groupId },
    data: { status: deriveGroupStatus(items.map((item) => item.status)) },
    select: groupSelect
  });
}

reservationsRouter.get('/groups', requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    let where: Prisma.ReservationGroupWhereInput;

    if (user.role === 'CLIENT') {
      where = { userId: user.sub };
    } else if (user.role === 'PHARMACY') {
      if (!user.pharmacyId) {
        res
          .status(403)
          .json({ error: 'Pharmacy account is not linked to a pharmacy' });
        return;
      }
      where = { pharmacyId: user.pharmacyId };
    } else {
      where = {};
    }

    const rows = await prisma.reservationGroup.findMany({
      where,
      select: groupSelect,
      orderBy: { createdAt: 'desc' }
    });

    res.json(rows.map(toGroup));
  } catch (error) {
    console.error('listReservationGroups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

reservationsRouter.post(
  '/groups',
  requireAuth,
  requireRole('CLIENT'),
  validateBody(reservationGroupCreateSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationGroupCreateInput;

    const merged = new Map<string, number>();
    for (const item of body.items) {
      merged.set(
        item.productId,
        (merged.get(item.productId) ?? 0) + item.quantity
      );
    }

    // Sorting by productId keeps the row-lock order consistent across
    // concurrent transactions and avoids deadlocks on multi-item carts.
    const items = [...merged.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId));

    try {
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

      const group = await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await deductStock(tx, body.pharmacyId, item.productId, item.quantity);
        }

        return tx.reservationGroup.create({
          data: {
            userId: user.sub,
            pharmacyId: body.pharmacyId,
            status: 'CONFIRMED',
            expiresAt,
            items: {
              create: items.map((item) => ({
                userId: user.sub,
                pharmacyId: body.pharmacyId,
                productId: item.productId,
                quantity: item.quantity,
                status: 'CONFIRMED',
                expiresAt
              }))
            }
          },
          select: groupSelect
        });
      });

      res.status(201).json(toGroup(group));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'NOT_FOUND') {
        res
          .status(404)
          .json({ error: 'Inventory not found for pharmacy/product' });
        return;
      }
      if (code === 'CONFLICT') {
        res.status(409).json({ error: 'Insufficient stock' });
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        res.status(400).json({ error: 'Invalid pharmacyId or productId' });
        return;
      }
      console.error('createReservationGroup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

reservationsRouter.post(
  '/groups/:id/pickup',
  requireAuth,
  requireRole('PHARMACY', 'ADMIN'),
  validateBody(reservationGroupPickupSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationGroupPickupInput;
    const groupId = String(req.params.id);

    try {
      const group = await prisma.$transaction(async (tx) => {
        const existing = await tx.reservationGroup.findUnique({
          where: { id: groupId },
          select: {
            id: true,
            pharmacyId: true,
            items: {
              select: {
                id: true,
                pharmacyId: true,
                productId: true,
                quantity: true,
                status: true
              }
            }
          }
        });

        if (!existing) {
          throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
        }

        if (
          user.role === 'PHARMACY' &&
          user.pharmacyId !== existing.pharmacyId
        ) {
          throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
        }

        const targetIds = body.all
          ? existing.items.filter((item) => isActive(item.status)).map((item) => item.id)
          : (body.itemIds ?? []);

        if (targetIds.length === 0) {
          throw Object.assign(new Error('No active items to pick up'), {
            code: 'CONFLICT'
          });
        }

        for (const itemId of targetIds) {
          const item = existing.items.find((candidate) => candidate.id === itemId);
          if (!item || !isActive(item.status)) {
            throw Object.assign(new Error('Invalid item for pickup'), {
              code: 'CONFLICT'
            });
          }
          await tx.reservation.update({
            where: { id: itemId },
            data: { status: 'PICKED_UP' }
          });
        }

        if (body.all !== true) {
          const notPicked = existing.items.filter(
            (item) => isActive(item.status) && !targetIds.includes(item.id)
          );

          for (const item of notPicked) {
            await restoreStock(
              tx,
              item.pharmacyId,
              item.productId,
              item.quantity
            );
            await tx.reservation.update({
              where: { id: item.id },
              data: { status: 'NOT_PICKED_UP' }
            });
          }
        }

        return refreshGroupStatus(tx, existing.id);
      });

      res.json(toGroup(group));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Reservation group not found' });
        return;
      }
      if (code === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (code === 'CONFLICT') {
        res.status(409).json({ error: (error as Error).message });
        return;
      }
      console.error('pickupReservationGroup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

reservationsRouter.post(
  '/groups/:id/cancel',
  requireAuth,
  validateBody(reservationGroupCancelSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationGroupCancelInput;
    const groupId = String(req.params.id);

    try {
      const group = await prisma.$transaction(async (tx) => {
        const existing = await tx.reservationGroup.findUnique({
          where: { id: groupId },
          select: {
            id: true,
            userId: true,
            pharmacyId: true,
            items: {
              select: {
                id: true,
                pharmacyId: true,
                productId: true,
                quantity: true,
                status: true
              }
            }
          }
        });

        if (!existing) {
          throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
        }

        const isOwner = existing.userId === user.sub;
        const isPharmacyOwner =
          user.role === 'PHARMACY' && user.pharmacyId === existing.pharmacyId;
        const isAdmin = user.role === 'ADMIN';

        if (!isOwner && !isPharmacyOwner && !isAdmin) {
          throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
        }

        const targetIds = body.all
          ? existing.items.filter((item) => isActive(item.status)).map((item) => item.id)
          : (body.itemIds ?? []);

        if (targetIds.length === 0) {
          throw Object.assign(new Error('No active items to cancel'), {
            code: 'CONFLICT'
          });
        }

        for (const itemId of targetIds) {
          const item = existing.items.find((candidate) => candidate.id === itemId);
          if (!item || !isActive(item.status)) {
            throw Object.assign(new Error('Invalid item for cancel'), {
              code: 'CONFLICT'
            });
          }
          await restoreStock(tx, item.pharmacyId, item.productId, item.quantity);
          await tx.reservation.update({
            where: { id: itemId },
            data: { status: 'CANCELLED' }
          });
        }

        return refreshGroupStatus(tx, existing.id);
      });

      res.json(toGroup(group));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Reservation group not found' });
        return;
      }
      if (code === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (code === 'CONFLICT') {
        res.status(409).json({ error: (error as Error).message });
        return;
      }
      console.error('cancelReservationGroup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
