import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      API_HOST: '0.0.0.0',
      API_PORT: '3001',
      DATABASE_URL:
        'postgresql://stock:stock_dev_password@localhost:5432/stock_for_pymes?schema=public',
      JWT_SECRET: 'test-secret-at-least-16-chars',
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:5173'
    }
  }
});
