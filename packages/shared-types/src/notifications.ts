import { z } from 'zod';

export const PushPlatformEnum = z.enum(['ios', 'android']);
export type PushPlatform = z.infer<typeof PushPlatformEnum>;

export const NotificationEventEnum = z.enum([
  'APPOINTMENT_CREATED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_CANCELLED',
  'JOURNEY_STARTED',
  'BARBER_ARRIVED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'REVIEW_REQUEST',
  'SUBSCRIPTION_RENEWAL',
  'SUBSCRIPTION_EXPIRING',
  'PROMOTION',
  'SYSTEM',
]);
export type NotificationEvent = z.infer<typeof NotificationEventEnum>;

export const RegisterPushDeviceSchema = z.object({
  installationId: z.string().min(8).max(128),
  expoPushToken: z
    .string()
    .min(20)
    .max(255)
    .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/),
  platform: PushPlatformEnum,
  appVersion: z.string().min(1).max(40),
});
export type RegisterPushDeviceRequest = z.infer<typeof RegisterPushDeviceSchema>;

export const PushDeviceParamsSchema = z.object({
  installationId: z.string().min(8).max(128),
});

export const NotificationParamsSchema = z.object({ notificationId: z.string().uuid() });

export const NotificationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  type: NotificationEventEnum,
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
  relatedData: z.object({
    appointmentId: z.string().uuid().optional(),
  }),
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const NotificationPageSchema = z.object({
  notifications: z.array(NotificationItemSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().uuid().nullable(),
});
export type NotificationPage = z.infer<typeof NotificationPageSchema>;
