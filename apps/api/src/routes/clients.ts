import {
  BookAppointmentSchema,
  ClientAppointmentParamsSchema,
  ClientAppointmentQuerySchema,
  CreateReviewSchema,
  SaveBarberSchema,
  UuidParamsSchema,
} from '@barber-saas/shared-types';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  type Router as ExpressRouter,
} from 'express';

import { requireAuth, requireRoles } from '../middleware/auth';
import {
  bookAppointment,
  cancelClientAppointment,
  createClientReview,
  getClientAppointment,
  getClientProfile,
  listClientAppointments,
  listSavedBarbers,
  removeSavedBarber,
  saveBarber,
} from '../services/client/clientService';
import type { AuthenticatedRequest } from '../types/auth';

export const clientRouter: ExpressRouter = Router();

const asyncHandler =
  (handler: (request: Request, response: Response) => Promise<void>): RequestHandler =>
  (request, response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };
const userId = (request: Request): string => (request as AuthenticatedRequest).auth.id;

clientRouter.use('/me', requireAuth, requireRoles('CLIENT'));

clientRouter.get(
  '/me',
  asyncHandler(async (request, response) => {
    response.json(await getClientProfile(userId(request)));
  }),
);

clientRouter.get(
  '/me/saved-barbers',
  asyncHandler(async (request, response) => {
    response.json(await listSavedBarbers(userId(request)));
  }),
);

clientRouter.post(
  '/me/saved-barbers',
  asyncHandler(async (request, response) => {
    const { barberId } = SaveBarberSchema.parse(request.body);
    response.status(201).json(await saveBarber(userId(request), barberId));
  }),
);

clientRouter.delete(
  '/me/saved-barbers/:barberId',
  asyncHandler(async (request, response) => {
    const { barberId } = UuidParamsSchema.parse(request.params);
    response.json(await removeSavedBarber(userId(request), barberId));
  }),
);

clientRouter.post(
  '/me/appointments',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(await bookAppointment(userId(request), BookAppointmentSchema.parse(request.body)));
  }),
);

clientRouter.get(
  '/me/appointments',
  asyncHandler(async (request, response) => {
    response.json(
      await listClientAppointments(
        userId(request),
        ClientAppointmentQuerySchema.parse(request.query),
      ),
    );
  }),
);

clientRouter.get(
  '/me/appointments/:appointmentId',
  asyncHandler(async (request, response) => {
    const { appointmentId } = ClientAppointmentParamsSchema.parse(request.params);
    response.json(await getClientAppointment(userId(request), appointmentId));
  }),
);

clientRouter.delete(
  '/me/appointments/:appointmentId',
  asyncHandler(async (request, response) => {
    const { appointmentId } = ClientAppointmentParamsSchema.parse(request.params);
    response.json(await cancelClientAppointment(userId(request), appointmentId));
  }),
);

clientRouter.post(
  '/me/reviews',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(await createClientReview(userId(request), CreateReviewSchema.parse(request.body)));
  }),
);
