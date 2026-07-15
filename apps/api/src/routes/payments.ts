import { CreatePaymentIntentSchema, RefundRequestSchema } from '@barber-saas/shared-types';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import { z } from 'zod';

import { requireAuth, requireRoles } from '../middleware/auth';
import {
  createAppointmentPaymentIntent,
  getAppointmentPaymentStatus,
  getClientPaymentConfig,
  refundAppointmentPayment,
} from '../services/payment/paymentService';
import type { AuthenticatedRequest } from '../types/auth';

export const paymentRouter: ExpressRouter = Router();
const PaymentAppointmentParamsSchema = z.object({ appointmentId: z.string().uuid() });

const asyncHandler =
  (handler: (request: Request, response: Response) => Promise<void>): RequestHandler =>
  (request, response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };

paymentRouter.get('/config', requireAuth, requireRoles('CLIENT'), (_request, response) =>
  response.json(getClientPaymentConfig()),
);

paymentRouter.post(
  '/create-intent',
  requireAuth,
  requireRoles('CLIENT'),
  asyncHandler(async (request, response) => {
    const { appointmentId } = CreatePaymentIntentSchema.parse(request.body);
    const user = (request as AuthenticatedRequest).auth;
    response.json(await createAppointmentPaymentIntent(user.id, appointmentId));
  }),
);

paymentRouter.get(
  '/appointment/:appointmentId',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { appointmentId } = PaymentAppointmentParamsSchema.parse(request.params);
    const user = (request as AuthenticatedRequest).auth;
    response.json(await getAppointmentPaymentStatus(user, appointmentId));
  }),
);

paymentRouter.post(
  '/refund',
  requireAuth,
  requireRoles('CLIENT'),
  asyncHandler(async (request, response) => {
    const { appointmentId, reason } = RefundRequestSchema.parse(request.body);
    const user = (request as AuthenticatedRequest).auth;
    response.json(await refundAppointmentPayment(user.id, appointmentId, reason));
  }),
);
