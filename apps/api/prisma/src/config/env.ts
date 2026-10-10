import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Only load .env files in development
if (process.env.NODE_ENV !== 'production') {
  config({ path: resolve(process.cwd(), '../../.env') });
  config();
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;
