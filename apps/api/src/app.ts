import express, { json, raw, type Express } from 'express';
import helmet from 'helmet';

import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { routes } from './routes';
import { stripeWebhookHandler } from './routes/webhooks';

export const createApp = (): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(corsMiddleware);
  app.post('/webhooks/stripe', raw({ type: 'application/json' }), (request, response, next) => {
    void stripeWebhookHandler(request, response).catch(next);
  });
  app.use(json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

export const app = createApp();
