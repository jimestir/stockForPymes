import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    inventory: { update: vi.fn() },
    reservation: { update: vi.fn(), findMany: vi.fn() },
    reservationGroup: { findUnique: vi.fn(), update: vi.fn() }
  };

  const prisma = {
    $transaction: vi.fn(),
    reservationGroup: { findMany: vi.fn() }
  };

  return { tx, prisma };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.prisma }));

import { expireReservationsOnce } from '../src/jobs/expireReservations.js';

const groupId = '44444444-4444-4444-8444-444444444444';
const userId = '11111111-1111-4111-8111-111111111111';
const pharmacyId = '22222222-2222-4222-8222-222222222222';
const productId = '55555555-5555-4555-8555-555555555555';
const itemId = '66666666-6666-4666-8666-666666666666';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.$transaction.mockImplementation(
    (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
});

describe('expireReservationsOnce', () => {
  it('expires overdue groups and restores stock', async () => {
    const past = new Date(Date.now() - 60_000);

    mocks.prisma.reservationGroup.findMany.mockResolvedValue([{ id: groupId }]);
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      status: 'CONFIRMED',
      expiresAt: past,
      items: [
        {
          id: itemId,
          pharmacyId,
          productId,
          quantity: 2,
          status: 'CONFIRMED'
        }
      ]
    });
    mocks.tx.$queryRaw.mockResolvedValue([
      { id: 'inventory-1', stock: 5, version: 1 }
    ]);
    mocks.tx.inventory.update.mockResolvedValue({});
    mocks.tx.reservation.update.mockResolvedValue({});
    mocks.tx.reservation.findMany.mockResolvedValue([{ status: 'EXPIRED' }]);
    mocks.tx.reservationGroup.update.mockResolvedValue({
      id: groupId,
      userId,
      pharmacyId,
      status: 'EXPIRED',
      expiresAt: past,
      createdAt: new Date()
    });

    const count = await expireReservationsOnce();

    expect(count).toBe(1);
    expect(mocks.tx.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inventory-1' },
      data: { stock: 7, version: { increment: 1 } }
    });
    expect(mocks.tx.reservation.update).toHaveBeenCalledWith({
      where: { id: itemId },
      data: { status: 'EXPIRED' }
    });
    expect(mocks.tx.reservationGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: groupId },
        data: { status: 'EXPIRED' }
      })
    );
  });

  it('ignores groups that have not expired yet', async () => {
    const future = new Date(Date.now() + 60_000);

    mocks.prisma.reservationGroup.findMany.mockResolvedValue([{ id: groupId }]);
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      status: 'CONFIRMED',
      expiresAt: future,
      items: []
    });

    const count = await expireReservationsOnce();

    expect(count).toBe(0);
    expect(mocks.tx.inventory.update).not.toHaveBeenCalled();
    expect(mocks.tx.reservation.update).not.toHaveBeenCalled();
  });

  it('ignores groups that are already closed', async () => {
    const past = new Date(Date.now() - 60_000);

    mocks.prisma.reservationGroup.findMany.mockResolvedValue([{ id: groupId }]);
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      status: 'CANCELLED',
      expiresAt: past,
      items: []
    });

    const count = await expireReservationsOnce();

    expect(count).toBe(0);
    expect(mocks.tx.inventory.update).not.toHaveBeenCalled();
  });
});
