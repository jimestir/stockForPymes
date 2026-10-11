import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pharmaciesRouter } from './routes/pharmacies.js';
import type { NextFunction, Request, Response } from 'express';


export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api' });
  });

  app.use('/api/pharmacies', pharmaciesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });


  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
