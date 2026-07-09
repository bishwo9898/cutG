import express, { type Express } from 'express';
import helmet from 'helmet';

import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { routes } from './routes';

export const createApp = (): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

export const app = createApp();
