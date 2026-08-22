import {
  NotificationParamsSchema,
  NotificationQuerySchema,
  PushDeviceParamsSchema,
  RegisterPushDeviceSchema,
} from '@barber-saas/shared-types';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  type Router as ExpressRouter,
} from 'express';

import { requireAuth } from '../middleware/auth';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushDevice,
  unregisterPushDevice,
} from '../services/notification/notificationService';
import type { AuthenticatedRequest } from '../types/auth';

export const notificationRouter: ExpressRouter = Router();
notificationRouter.use(requireAuth);

const asyncHandler =
  (handler: (request: Request, response: Response) => Promise<void>): RequestHandler =>
  (request, response, next: NextFunction): void => {
    void handler(request, response).catch(next);
  };
const userId = (request: Request): string => (request as AuthenticatedRequest).auth.id;

notificationRouter.post(
  '/devices',
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(
        await registerPushDevice(userId(request), RegisterPushDeviceSchema.parse(request.body)),
      );
  }),
);
notificationRouter.delete(
  '/devices/:installationId',
  asyncHandler(async (request, response) => {
    const { installationId } = PushDeviceParamsSchema.parse(request.params);
    response.json(await unregisterPushDevice(userId(request), installationId));
  }),
);
notificationRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    response.json(
      await listNotifications(userId(request), NotificationQuerySchema.parse(request.query)),
    );
  }),
);
notificationRouter.patch(
  '/:notificationId/read',
  asyncHandler(async (request, response) => {
    const { notificationId } = NotificationParamsSchema.parse(request.params);
    response.json(await markNotificationRead(userId(request), notificationId));
  }),
);
notificationRouter.post(
  '/read-all',
  asyncHandler(async (request, response) => {
    response.json(await markAllNotificationsRead(userId(request)));
  }),
);
