import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { inventoryRouter } from './routes/inventory.js';
import { pharmaciesRouter } from './routes/pharmacies.js';
import { productsRouter } from './routes/products.js';
import { reservationsRouter } from './routes/reservations.js';
import { createSearchRouter } from './routes/search.js';
import { prismaSearchRepository } from './search/prisma-search-repository.js';
import type { SearchRepository } from './search/types.js';
import type { NextFunction, Request, Response } from 'express';
import { env } from './config/env.js';

export interface AppDependencies {
  searchRepository?: SearchRepository;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api' });
  });

  app.set('trust proxy', 1);

  app.use('/api/pharmacies', pharmaciesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use(
    '/api/search',
    createSearchRouter(dependencies.searchRepository ?? prismaSearchRepository)
  );
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
