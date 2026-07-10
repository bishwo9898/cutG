import {
  AppointmentFilterSchema,
  AppointmentParamsSchema,
  BarberSearchQuerySchema,
  BlockDateSchema,
  BlockedDateParamsSchema,
  CreateBarberProfileSchema,
  CreateServiceSchema,
  DateRangeSchema,
  GenerateSlotsSchema,
  PublicSlotsQuerySchema,
  ReviewQuerySchema,
  ServiceFilterSchema,
  ServiceParamsSchema,
  SetScheduleSchema,
  UpdateAppointmentStatusSchema,
  UpdateBarberPhotoSchema,
  UpdateBarberProfileSchema,
  UpdateServiceSchema,
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
  blockDate,
  createOffering,
  createProfile,
  deactivateOffering,
  generateSlots,
  getMyProfile,
  getOffering,
  getPublicOfferings,
  getPublicProfile,
  getPublicSlots,
  getSchedule,
  listAppointments,
  listBlockedDates,
  listOfferings,
  listSlots,
  setSchedule,
  unblockDate,
  updateAppointmentStatus,
  updateOffering,
  updatePhoto,
  updateProfile,
} from '../services/barber/barberService';
import { listPublicReviews, searchBarbers } from '../services/discovery/barberSearchService';
import type { AuthenticatedRequest } from '../types/auth';
import { addDaysToDate } from '../utils/slotGenerator';

export const barberRouter: ExpressRouter = Router();
const asyncHandler =
  (handler: (request: Request, response: Response) => Promise<void>): RequestHandler =>
  (request, response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };
const userId = (request: Request): string => (request as AuthenticatedRequest).auth.id;

barberRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    response.json(await searchBarbers(BarberSearchQuerySchema.parse(request.query)));
  }),
);

barberRouter.use('/me', requireAuth, requireRoles('BARBER'));

barberRouter.get(
  '/me',
  asyncHandler(async (request, response) => {
    response.json(await getMyProfile(userId(request)));
  }),
);
barberRouter.post(
  '/me/profile',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(await createProfile(userId(request), CreateBarberProfileSchema.parse(request.body)));
  }),
);
barberRouter.patch(
  '/me/profile',
  asyncHandler(async (request, response) => {
    response.json(
      await updateProfile(userId(request), UpdateBarberProfileSchema.parse(request.body)),
    );
  }),
);
barberRouter.post(
  '/me/photo',
  asyncHandler(async (request, response) => {
    const { photoUrl } = UpdateBarberPhotoSchema.parse(request.body);
    response.json(await updatePhoto(userId(request), photoUrl));
  }),
);

barberRouter.post(
  '/me/services',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(await createOffering(userId(request), CreateServiceSchema.parse(request.body)));
  }),
);
barberRouter.get(
  '/me/services',
  asyncHandler(async (request, response) => {
    const filters = ServiceFilterSchema.parse(request.query);
    response.json(await listOfferings(userId(request), filters.active, filters.category));
  }),
);
barberRouter.get(
  '/me/services/:serviceId',
  asyncHandler(async (request, response) => {
    const { serviceId } = ServiceParamsSchema.parse(request.params);
    response.json(await getOffering(userId(request), serviceId));
  }),
);
barberRouter.patch(
  '/me/services/:serviceId',
  asyncHandler(async (request, response) => {
    const { serviceId } = ServiceParamsSchema.parse(request.params);
    response.json(
      await updateOffering(userId(request), serviceId, UpdateServiceSchema.parse(request.body)),
    );
  }),
);
barberRouter.delete(
  '/me/services/:serviceId',
  asyncHandler(async (request, response) => {
    const { serviceId } = ServiceParamsSchema.parse(request.params);
    response.json(await deactivateOffering(userId(request), serviceId));
  }),
);

barberRouter.get(
  '/me/schedule',
  asyncHandler(async (request, response) => {
    response.json(await getSchedule(userId(request)));
  }),
);
barberRouter.put(
  '/me/schedule',
  asyncHandler(async (request, response) => {
    const { schedule } = SetScheduleSchema.parse(request.body);
    response.json(await setSchedule(userId(request), schedule));
  }),
);
barberRouter.get(
  '/me/slots',
  asyncHandler(async (request, response) => {
    const range = DateRangeSchema.parse(request.query);
    response.json(await listSlots(userId(request), range.startDate, range.endDate));
  }),
);
barberRouter.post(
  '/me/slots/generate',
  asyncHandler(async (request, response) => {
    const range = GenerateSlotsSchema.parse(request.body);
    response.json(await generateSlots(userId(request), range.startDate, range.endDate));
  }),
);
barberRouter.post(
  '/me/blocked-dates',
  asyncHandler(async (request, response) => {
    const input = BlockDateSchema.parse(request.body);
    response.status(201).json(await blockDate(userId(request), input.date, input.reason));
  }),
);
barberRouter.get(
  '/me/blocked-dates',
  asyncHandler(async (request, response) => {
    response.json(await listBlockedDates(userId(request)));
  }),
);
barberRouter.delete(
  '/me/blocked-dates/:date',
  asyncHandler(async (request, response) => {
    const { date } = BlockedDateParamsSchema.parse(request.params);
    response.json(await unblockDate(userId(request), date));
  }),
);

barberRouter.get(
  '/me/appointments',
  asyncHandler(async (request, response) => {
    response.json(
      await listAppointments(userId(request), AppointmentFilterSchema.parse(request.query)),
    );
  }),
);
barberRouter.patch(
  '/me/appointments/:appointmentId/status',
  asyncHandler(async (request, response) => {
    const { appointmentId } = AppointmentParamsSchema.parse(request.params);
    const input = UpdateAppointmentStatusSchema.parse(request.body);
    response.json(
      await updateAppointmentStatus(userId(request), appointmentId, input.status, input.notes),
    );
  }),
);

barberRouter.get(
  '/:barberId/reviews',
  asyncHandler(async (request, response) => {
    const { barberId } = UuidParamsSchema.parse(request.params);
    response.json(await listPublicReviews(barberId, ReviewQuerySchema.parse(request.query)));
  }),
);
barberRouter.get(
  '/:barberId',
  asyncHandler(async (request, response) => {
    const { barberId } = UuidParamsSchema.parse(request.params);
    response.json(await getPublicProfile(barberId));
  }),
);
barberRouter.get(
  '/:barberId/services',
  asyncHandler(async (request, response) => {
    const { barberId } = UuidParamsSchema.parse(request.params);
    response.json(await getPublicOfferings(barberId));
  }),
);
barberRouter.get(
  '/:barberId/slots',
  asyncHandler(async (request, response) => {
    const { barberId } = UuidParamsSchema.parse(request.params);
    const options = PublicSlotsQuerySchema.parse(request.query);
    const startDate = options.date ?? new Date().toISOString().slice(0, 10);
    response.json(
      await getPublicSlots(barberId, startDate, addDaysToDate(startDate, options.days - 1)),
    );
  }),
);
