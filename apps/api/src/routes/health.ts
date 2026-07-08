import { Router, type Router as ExpressRouter } from 'express';

import { checkDatabaseHealth } from '../utils/database';

type HealthResponse = {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'ok' | 'error';
    latencyMs?: number;
  };
};

export const healthRouter: ExpressRouter = Router();

healthRouter.get('/', (request, response, next): void => {
  void request;

  void (async (): Promise<void> => {
    const database = await checkDatabaseHealth();

    const body: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database,
    };

    response.status(database.status === 'ok' ? 200 : 503).json(body);
  })().catch(next);
});
