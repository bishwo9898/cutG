import { z } from 'zod';

import { AppointmentStatusEnum, PaymentStatusEnum, UserTypeEnum } from './enums';

export const ApiErrorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number(),
  database: z.object({
    status: z.enum(['ok', 'error']),
    latencyMs: z.number().optional(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  phone: z.string().min(7).max(20).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  userType: UserTypeEnum,
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const CreateAppointmentRequestSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  availabilitySlotId: z.string().uuid(),
  clientNotes: z.string().max(2000).optional(),
});
export type CreateAppointmentRequest = z.infer<typeof CreateAppointmentRequestSchema>;

export const AppointmentResponseSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  scheduledAt: z.date(),
  status: AppointmentStatusEnum,
  paymentStatus: PaymentStatusEnum,
  priceQuoted: z.number(),
  createdAt: z.date(),
});
export type AppointmentResponse = z.infer<typeof AppointmentResponseSchema>;
