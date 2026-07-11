import { z } from 'zod';

import { ServiceCategoryEnum } from './barber';
import { AppointmentStatusEnum } from './enums';
import { BookMobileAppointmentExtensionSchema } from './mobile';

export const BookAppointmentSchema = z
  .object({
    barberId: z.string().uuid(),
    serviceId: z.string().uuid(),
    availabilitySlotId: z.string().uuid(),
    clientNotes: z.string().trim().max(1000).optional(),
  })
  .and(BookMobileAppointmentExtensionSchema);
export type BookAppointmentRequest = z.infer<typeof BookAppointmentSchema>;

export const ClientAppointmentQuerySchema = z
  .object({
    status: AppointmentStatusEnum.optional(),
    upcoming: z.coerce.boolean().optional(),
    past: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((value) => !(value.upcoming === true && value.past === true), {
    message: 'Use either upcoming or past, not both',
  });
export type ClientAppointmentQuery = z.infer<typeof ClientAppointmentQuerySchema>;

export const BarberSearchQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  category: ServiceCategoryEnum.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  verified: z.coerce.boolean().optional(),
  mobileOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export type BarberSearchQuery = z.infer<typeof BarberSearchQuerySchema>;

export const CreateReviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(255).optional(),
  comment: z.string().trim().max(2000).optional(),
});
export type CreateReviewRequest = z.infer<typeof CreateReviewSchema>;

export const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'highest', 'lowest']).default('newest'),
});
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;

export const SaveBarberSchema = z.object({
  barberId: z.string().uuid(),
});
export type SaveBarberRequest = z.infer<typeof SaveBarberSchema>;

export const ClientAppointmentParamsSchema = z.object({
  appointmentId: z.string().uuid(),
});
