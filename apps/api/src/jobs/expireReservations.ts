import { prisma } from '../lib/prisma.js';
import { deriveGroupStatus } from '../reservations/status.js';

type InventoryLockRow = {
  id: string;
  stock: number;
  version: number;
};

const DEFAULT_INTERVAL_MS = 60_000;

export async function expireReservationsOnce(): Promise<number> {
  const now = new Date();

  const groups = await prisma.reservationGroup.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PARTIALLY_PICKED_UP'] },
      expiresAt: { lte: now }
    },
    select: { id: true },
    take: 50
  });

  let expiredGroups = 0;

  for (const group of groups) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.reservationGroup.findUnique({
          where: { id: group.id },
          select: {
            id: true,
            status: true,
            expiresAt: true,
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

        if (!current) {
          return null;
        }
        if (current.expiresAt > now) {
          return null;
        }
        if (
          current.status !== 'CONFIRMED' &&
          current.status !== 'PARTIALLY_PICKED_UP'
        ) {
          return null;
        }

        for (const item of current.items) {
          if (item.status !== 'CONFIRMED' && item.status !== 'PENDING') {
            continue;
          }

          const locked = await tx.$queryRaw<InventoryLockRow[]>`
            SELECT id, stock, version
            FROM inventory
            WHERE pharmacy_id = ${item.pharmacyId}::uuid
              AND product_id = ${item.productId}::uuid
            FOR UPDATE
          `;

          const inventory = locked[0];
          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                stock: inventory.stock + item.quantity,
                version: { increment: 1 }
              }
            });
          }

          await tx.reservation.update({
            where: { id: item.id },
            data: { status: 'EXPIRED' }
          });
        }

        const items = await tx.reservation.findMany({
          where: { groupId: current.id },
          select: { status: true }
        });

        return tx.reservationGroup.update({
          where: { id: current.id },
          data: { status: deriveGroupStatus(items.map((item) => item.status)) },
          select: {
            id: true,
            userId: true,
            pharmacyId: true,
            status: true,
            expiresAt: true,
            createdAt: true
          }
        });
      });

      if (updated) {
        expiredGroups += 1;
      }
    } catch (error) {
      console.error('expireReservations group error:', group.id, error);
    }
  }

  return expiredGroups;
}

export function startExpireReservationsJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const tick = async () => {
    try {
      const count = await expireReservationsOnce();
      if (count > 0) {
        console.log(`Expired ${count} reservation group(s)`);
      }
    } catch (error) {
      console.error('expireReservations job error:', error);
    }
  };

  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  if (typeof handle.unref === 'function') {
    handle.unref();
  }

  return () => clearInterval(handle);
}
