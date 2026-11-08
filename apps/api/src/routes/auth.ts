import { Router } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput
} from '../schemas/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  pharmacyId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    pharmacyId: user.pharmacyId
  };
}

authRouter.post('/register',registerLimiter, validateBody(registerSchema), async (req, res) => {
  const body = req.body as RegisterInput;

  try {
    if (body.role === 'PHARMACY' && body.pharmacyId) {
      const pharmacy = await prisma.pharmacy.findUnique({
        where: { id: body.pharmacyId },
        select: { id: true }
      });
      if (!pharmacy) {
        res.status(400).json({ error: 'Pharmacy not found' });
        return;
      }
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        passwordHash,
        name: body.name,
        phone: body.phone,
        role: body.role,
        pharmacyId: body.role === 'PHARMACY' ? body.pharmacyId : null
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        pharmacyId: true
      }
    });

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      pharmacyId: user.pharmacyId
    });

    res.status(201).json({
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    console.error('register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/login',loginLimiter, validateBody(loginSchema), async (req, res) => {
  const body = req.body as LoginInput;

  try {
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        pharmacyId: true,
        passwordHash: true
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      pharmacyId: user.pharmacyId
    });

    res.json({
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    console.error('login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        pharmacyId: true
      }
    });

    // The token is valid but the user no longer exists (deleted account).
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
