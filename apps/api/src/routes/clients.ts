import {
  AddressParamsSchema,
  AttachHairDesignSchema,
  BookAppointmentSchema,
  ClientAppointmentParamsSchema,
  ClientAppointmentQuerySchema,
  CreateReviewSchema,
  CreateHairDesignSchema,
  HairDesignParamsSchema,
  PaymentHistoryQuerySchema,
  SaveAddressSchema,
  SaveBarberSchema,
  UuidParamsSchema,
  UpdateAddressSchema,
  TrackingAppointmentParamsSchema,
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
  getAppointmentStatusUpdates,
  getClientProfile,
  listClientAppointments,
  listSavedBarbers,
  removeSavedBarber,
  saveBarber,
} from '../services/client/clientService';
import {
  attachHairDesign,
  createHairDesign,
  listHairDesigns,
} from '../services/design/hairDesignService';
import { getLatestBarberLocation } from '../services/location/locationTrackingService';
import {
  createClientAddress,
  deleteClientAddress,
  listClientAddresses,
  setDefaultClientAddress,
  updateClientAddress,
} from '../services/mobile/geocodingService';
import { listClientPaymentHistory } from '../services/payment/paymentService';
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
  '/me/addresses',
  asyncHandler(async (request, response) => {
    response.json(await listClientAddresses(userId(request)));
  }),
);
clientRouter.post(
  '/me/addresses',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(await createClientAddress(userId(request), SaveAddressSchema.parse(request.body)));
  }),
);
clientRouter.patch(
  '/me/addresses/:addressId',
  asyncHandler(async (request, response) => {
    const { addressId } = AddressParamsSchema.parse(request.params);
    response.json(
      await updateClientAddress(
        userId(request),
        addressId,
        UpdateAddressSchema.parse(request.body),
      ),
    );
  }),
);
clientRouter.delete(
  '/me/addresses/:addressId',
  asyncHandler(async (request, response) => {
    const { addressId } = AddressParamsSchema.parse(request.params);
    response.json(await deleteClientAddress(userId(request), addressId));
  }),
);
clientRouter.post(
  '/me/addresses/:addressId/set-default',
  asyncHandler(async (request, response) => {
    const { addressId } = AddressParamsSchema.parse(request.params);
    response.json(await setDefaultClientAddress(userId(request), addressId));
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
  '/me/designs',
  asyncHandler(async (request, response) => {
    response.json(await listHairDesigns(userId(request)));
  }),
);
clientRouter.post(
  '/me/designs',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(await createHairDesign(userId(request), CreateHairDesignSchema.parse(request.body)));
  }),
);
clientRouter.post(
  '/me/designs/:designId/attach',
  asyncHandler(async (request, response) => {
    const { designId } = HairDesignParamsSchema.parse(request.params);
    const { appointmentId } = AttachHairDesignSchema.parse(request.body);
    response.json(await attachHairDesign(userId(request), designId, appointmentId));
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
  '/me/appointments/:appointmentId/status-updates',
  asyncHandler(async (request, response) => {
    const { appointmentId } = ClientAppointmentParamsSchema.parse(request.params);
    response.json(await getAppointmentStatusUpdates(userId(request), appointmentId));
  }),
);

clientRouter.get(
  '/me/appointments/:appointmentId/barber-location',
  asyncHandler(async (request, response) => {
    const { appointmentId } = TrackingAppointmentParamsSchema.parse(request.params);
    response.json(await getLatestBarberLocation(userId(request), appointmentId));
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

clientRouter.get(
  '/me/payment-history',
  asyncHandler(async (request, response) => {
    const query = PaymentHistoryQuerySchema.parse(request.query);
    response.json(await listClientPaymentHistory(userId(request), query.page, query.limit));
  }),
);
