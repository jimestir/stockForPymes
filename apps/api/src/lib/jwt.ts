import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env.js';

export const JwtPayloadSchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  role: z.nativeEnum(UserRole),
  pharmacyId: z.uuid().nullable()
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as StringValue
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }

  const result = JwtPayloadSchema.safeParse(decoded);
  if (!result.success) {
    throw new Error('Invalid token payload');
  }

  return result.data;
}
