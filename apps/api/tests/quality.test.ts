import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../src/lib/password.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { createApp } from '../src/app.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.prisma }));

const clientToken = signAccessToken({
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'client@test.local',
  role: 'CLIENT',
  pharmacyId: null
});

function createQualityApp() {
  return createApp({
    searchRepository: { search: vi.fn(async () => []) }
  });
}

beforeEach(() => {
  mocks.prisma.user.findUnique.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sprint 7 quality smoke checks', () => {
  it('returns the API health status', async () => {
    const response = await request(createQualityApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api' });
  });

  it('authenticates a user with valid credentials', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'client@test.local',
      name: 'Test Client',
      role: 'CLIENT',
      pharmacyId: null,
      passwordHash: await hashPassword('Password123!')
    });

    const response = await request(createQualityApp())
      .post('/api/auth/login')
      .send({ email: 'client@test.local', password: 'Password123!' });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: 'client@test.local',
      role: 'CLIENT'
    });
  });

  it('rejects an authenticated route without a token', async () => {
    const response = await request(createQualityApp()).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Missing or invalid Authorization header' });
  });

  it('rejects a client attempting an admin-only pharmacy operation', async () => {
    const response = await request(createQualityApp())
      .post('/api/pharmacies')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'Farmacia Test', address: 'Calle Test 1', cp: '28001' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden' });
  });
});
