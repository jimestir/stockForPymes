import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../src/lib/jwt.js';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    inventory: { update: vi.fn() },
    reservation: { update: vi.fn(), findMany: vi.fn() },
    reservationGroup: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };

  const prisma = {
    $transaction: vi.fn(),
    reservationGroup: { findMany: vi.fn() }
  };

  return { tx, prisma };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.prisma }));

import { reservationsRouter } from '../src/routes/reservations.js';

const clientId = '11111111-1111-4111-8111-111111111111';
const otherClientId = '99999999-9999-4999-8999-999999999999';
const pharmacyId = '22222222-2222-4222-8222-222222222222';
const otherPharmacyId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const productId = '55555555-5555-4555-8555-555555555555';
const itemOneId = '66666666-6666-4666-8666-666666666666';
const itemTwoId = '77777777-7777-4777-8777-777777777777';

const expiresAt = new Date('2026-11-18T13:00:00.000Z');
const createdAt = new Date('2026-11-18T12:30:00.000Z');

function tokenFor(
  role: 'CLIENT' | 'PHARMACY' | 'ADMIN',
  options: { sub?: string; pharmacyId?: string | null } = {}
) {
  return signAccessToken({
    sub: options.sub ?? clientId,
    email: 'test@example.com',
    role,
    pharmacyId: options.pharmacyId ?? null
  });
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: itemOneId,
    groupId,
    userId: clientId,
    pharmacyId,
    productId,
    quantity: 1,
    status: 'CONFIRMED',
    expiresAt,
    createdAt,
    product: { name: 'Paracetamol 500 mg' },
    pharmacy: { name: 'Farmacia Central' },
    user: { name: 'Cliente', email: 'cliente@example.com', phone: null },
    ...overrides
  };
}

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: groupId,
    userId: clientId,
    pharmacyId,
    status: 'CONFIRMED',
    expiresAt,
    createdAt,
    pharmacy: { name: 'Farmacia Central' },
    user: { name: 'Cliente', email: 'cliente@example.com', phone: null },
    items: [item()],
    ...overrides
  };
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reservations', reservationsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.$transaction.mockImplementation(
    (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
});

describe('POST /api/reservations/groups', () => {
  it('returns 400 for an invalid body', async () => {
    const response = await request(createTestApp())
      .post('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('CLIENT')}`)
      .send({ pharmacyId: 'not-a-uuid', items: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid body');
  });

  it('returns 409 when stock is insufficient', async () => {
    mocks.tx.$queryRaw.mockResolvedValue([
      { id: 'inventory-1', stock: 1, version: 1 }
    ]);

    const response = await request(createTestApp())
      .post('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('CLIENT')}`)
      .send({
        pharmacyId,
        items: [{ productId, quantity: 2 }]
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Insufficient stock' });
  });

  it('creates a group and decrements stock', async () => {
    mocks.tx.$queryRaw.mockResolvedValue([
      { id: 'inventory-1', stock: 10, version: 1 }
    ]);
    mocks.tx.inventory.update.mockResolvedValue({});
    mocks.tx.reservationGroup.create.mockResolvedValue(group());

    const response = await request(createTestApp())
      .post('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('CLIENT')}`)
      .send({
        pharmacyId,
        items: [{ productId, quantity: 3 }]
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(groupId);
    expect(mocks.tx.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inventory-1' },
      data: { stock: 7, version: { increment: 1 } }
    });
  });

  it('rejects non-client roles', async () => {
    const response = await request(createTestApp())
      .post('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('PHARMACY', { pharmacyId })}`)
      .send({ pharmacyId, items: [{ productId, quantity: 1 }] });

    expect(response.status).toBe(403);
  });
});

describe('GET /api/reservations/groups', () => {
  it('filters by the authenticated client', async () => {
    mocks.prisma.reservationGroup.findMany.mockResolvedValue([group()]);

    const response = await request(createTestApp())
      .get('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('CLIENT')}`);

    expect(response.status).toBe(200);
    expect(mocks.prisma.reservationGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: clientId } })
    );
  });

  it('filters by the pharmacy of the authenticated pharmacy user', async () => {
    mocks.prisma.reservationGroup.findMany.mockResolvedValue([]);

    const response = await request(createTestApp())
      .get('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('PHARMACY', { pharmacyId })}`);

    expect(response.status).toBe(200);
    expect(mocks.prisma.reservationGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pharmacyId } })
    );
  });

  it('returns 403 when a pharmacy account is not linked', async () => {
    const response = await request(createTestApp())
      .get('/api/reservations/groups')
      .set('Authorization', `Bearer ${tokenFor('PHARMACY')}`);

    expect(response.status).toBe(403);
  });
});

describe('POST /api/reservations/groups/:id/pickup', () => {
  it('returns 400 when neither all nor itemIds is provided', async () => {
    const response = await request(createTestApp())
      .post(`/api/reservations/groups/${groupId}/pickup`)
      .set('Authorization', `Bearer ${tokenFor('PHARMACY', { pharmacyId })}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid body');
  });

  it('returns 403 when the pharmacy does not own the group', async () => {
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      pharmacyId,
      items: [
        {
          id: itemOneId,
          pharmacyId,
          productId,
          quantity: 1,
          status: 'CONFIRMED'
        }
      ]
    });

    const response = await request(createTestApp())
      .post(`/api/reservations/groups/${groupId}/pickup`)
      .set(
        'Authorization',
        `Bearer ${tokenFor('PHARMACY', { pharmacyId: otherPharmacyId })}`
      )
      .send({ all: true });

    expect(response.status).toBe(403);
  });

  it('picks up all active items', async () => {
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      pharmacyId,
      items: [
        {
          id: itemOneId,
          pharmacyId,
          productId,
          quantity: 1,
          status: 'CONFIRMED'
        },
        {
          id: itemTwoId,
          pharmacyId,
          productId,
          quantity: 2,
          status: 'CONFIRMED'
        }
      ]
    });
    mocks.tx.reservation.update.mockResolvedValue({});
    mocks.tx.reservation.findMany.mockResolvedValue([
      { status: 'PICKED_UP' },
      { status: 'PICKED_UP' }
    ]);
    mocks.tx.reservationGroup.update.mockResolvedValue(
      group({
        status: 'PICKED_UP',
        items: [
          item({ id: itemOneId, status: 'PICKED_UP' }),
          item({ id: itemTwoId, status: 'PICKED_UP', quantity: 2 })
        ]
      })
    );

    const response = await request(createTestApp())
      .post(`/api/reservations/groups/${groupId}/pickup`)
      .set('Authorization', `Bearer ${tokenFor('PHARMACY', { pharmacyId })}`)
      .send({ all: true });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('PICKED_UP');
    expect(mocks.tx.reservation.update).toHaveBeenCalledTimes(2);
    expect(mocks.tx.reservation.update).toHaveBeenCalledWith({
      where: { id: itemOneId },
      data: { status: 'PICKED_UP' }
    });
  });

  it('marks unselected items as not picked up and restores their stock', async () => {
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      pharmacyId,
      items: [
        {
          id: itemOneId,
          pharmacyId,
          productId,
          quantity: 1,
          status: 'CONFIRMED'
        },
        {
          id: itemTwoId,
          pharmacyId,
          productId,
          quantity: 2,
          status: 'CONFIRMED'
        }
      ]
    });
    mocks.tx.reservation.update.mockResolvedValue({});
    mocks.tx.$queryRaw.mockResolvedValue([
      { id: 'inventory-1', stock: 4, version: 1 }
    ]);
    mocks.tx.inventory.update.mockResolvedValue({});
    mocks.tx.reservation.findMany.mockResolvedValue([
      { status: 'PICKED_UP' },
      { status: 'NOT_PICKED_UP' }
    ]);
    mocks.tx.reservationGroup.update.mockResolvedValue(
      group({
        status: 'PARTIALLY_PICKED_UP',
        items: [
          item({ id: itemOneId, status: 'PICKED_UP' }),
          item({ id: itemTwoId, status: 'NOT_PICKED_UP', quantity: 2 })
        ]
      })
    );

    const response = await request(createTestApp())
      .post(`/api/reservations/groups/${groupId}/pickup`)
      .set('Authorization', `Bearer ${tokenFor('PHARMACY', { pharmacyId })}`)
      .send({ itemIds: [itemOneId] });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('PARTIALLY_PICKED_UP');
    expect(mocks.tx.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inventory-1' },
      data: { stock: 6, version: { increment: 1 } }
    });
    expect(mocks.tx.reservation.update).toHaveBeenCalledWith({
      where: { id: itemTwoId },
      data: { status: 'NOT_PICKED_UP' }
    });
  });
});

describe('POST /api/reservations/groups/:id/cancel', () => {
  it('returns 403 when the user is not the owner, pharmacy or admin', async () => {
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      userId: clientId,
      pharmacyId,
      items: [
        {
          id: itemOneId,
          pharmacyId,
          productId,
          quantity: 1,
          status: 'CONFIRMED'
        }
      ]
    });

    const response = await request(createTestApp())
      .post(`/api/reservations/groups/${groupId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor('CLIENT', { sub: otherClientId })}`)
      .send({ all: true });

    expect(response.status).toBe(403);
  });

  it('cancels active items and restores stock', async () => {
    mocks.tx.reservationGroup.findUnique.mockResolvedValue({
      id: groupId,
      userId: clientId,
      pharmacyId,
      items: [
        {
          id: itemOneId,
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
    mocks.tx.reservation.findMany.mockResolvedValue([{ status: 'CANCELLED' }]);
    mocks.tx.reservationGroup.update.mockResolvedValue(
      group({
        status: 'CANCELLED',
        items: [item({ id: itemOneId, status: 'CANCELLED', quantity: 2 })]
      })
    );

    const response = await request(createTestApp())
      .post(`/api/reservations/groups/${groupId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor('CLIENT')}`)
      .send({ all: true });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CANCELLED');
    expect(mocks.tx.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inventory-1' },
      data: { stock: 7, version: { increment: 1 } }
    });
    expect(mocks.tx.reservation.update).toHaveBeenCalledWith({
      where: { id: itemOneId },
      data: { status: 'CANCELLED' }
    });
  });
});
