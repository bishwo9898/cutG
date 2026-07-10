import { Router, type Router as ExpressRouter } from 'express';

import { API_VERSION, APP_NAME } from '../config/constants';

import { authRouter } from './auth';
import { barberRouter } from './barbers';
import { clientRouter } from './clients';
import { healthRouter } from './health';
import { paymentRouter } from './payments';

export const routes: ExpressRouter = Router();

routes.get('/', (_request, response): void => {
  response.json({
    name: APP_NAME,
    version: API_VERSION,
    status: 'ok',
    links: {
      auth: '/auth',
      barbers: '/barbers',
      clients: '/clients',
      health: '/health',
      payments: '/payments',
    },
  });
});

routes.use('/auth', authRouter);
routes.use('/barbers', barberRouter);
routes.use('/clients', clientRouter);
routes.use('/health', healthRouter);
routes.use('/payments', paymentRouter);
