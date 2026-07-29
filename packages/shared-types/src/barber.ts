import { z } from 'zod';

import { AppointmentStatusEnum } from './enums';

export const ServiceCategoryEnum = z.enum([
  'haircut',
  'beard',
  'shave',
  'color',
  'combo',
  'kids',
  'other',
]);
export const ServiceDurationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(90),
  z.literal(120),
]);
export const ScheduleSlotDurationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);

const DateStringSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Must be a valid date in YYYY-MM-DD format');

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must use HH:MM format');
// Zod preserves the concrete object shape through this shared refinement helper.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const nonEmptyPatch = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const BarberProfileFieldsSchema = z.object({
  businessName: z.string().trim().min(1).max(255),
  bio: z.string().trim().max(1000).optional(),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  zipCode: z.string().trim().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export const CreateBarberProfileSchema = BarberProfileFieldsSchema.refine(
  (value) => (value.latitude === undefined) === (value.longitude === undefined),
  {
    message: 'Latitude and longitude must be provided together',
  },
);
export type CreateBarberProfileRequest = z.infer<typeof CreateBarberProfileSchema>;

export const UpdateBarberProfileSchema = nonEmptyPatch(BarberProfileFieldsSchema.partial()).refine(
  (value) => (value.latitude === undefined) === (value.longitude === undefined),
  { message: 'Latitude and longitude must be provided together' },
);
export type UpdateBarberProfileRequest = z.infer<typeof UpdateBarberProfileSchema>;

export const UpdateBarberPhotoSchema = z.object({ photoUrl: z.string().url().max(500) });

export const ShopLocationSearchSchema = z
  .object({
    query: z.string().trim().min(3).max(250),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: 'Latitude and longitude must be provided together',
  });
export type ShopLocationSearchRequest = z.infer<typeof ShopLocationSearchSchema>;

export const ShopLocationReverseGeocodeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type ShopLocationReverseGeocodeRequest = z.infer<typeof ShopLocationReverseGeocodeSchema>;

export const CreateServiceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  price: z.number().positive().multipleOf(0.01),
  durationMinutes: ServiceDurationSchema,
  category: ServiceCategoryEnum,
});
export type CreateServiceRequest = z.infer<typeof CreateServiceSchema>;

export const UpdateServiceSchema = nonEmptyPatch(
  CreateServiceSchema.partial().extend({ isActive: z.boolean().optional() }),
);
export type UpdateServiceRequest = z.infer<typeof UpdateServiceSchema>;

export const ServiceFilterSchema = z.object({
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  category: ServiceCategoryEnum.optional(),
});

export const UuidParamsSchema = z.object({ barberId: z.string().uuid() });
export const ServiceParamsSchema = z.object({ serviceId: z.string().uuid() });
export const AppointmentParamsSchema = z.object({ appointmentId: z.string().uuid() });

export const ScheduleEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: TimeSchema,
    endTime: TimeSchema,
    slotDurationMinutes: ScheduleSlotDurationSchema,
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: 'Start time must be before end time',
  });
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

export const SetScheduleSchema = z
  .object({ schedule: z.array(ScheduleEntrySchema).min(1).max(7) })
  .refine(
    ({ schedule }) => new Set(schedule.map(({ dayOfWeek }) => dayOfWeek)).size === schedule.length,
    { message: 'Schedule cannot contain duplicate days' },
  );
export type SetScheduleRequest = z.infer<typeof SetScheduleSchema>;

const DateRangeShape = z.object({ startDate: DateStringSchema, endDate: DateStringSchema });
export const DateRangeSchema = DateRangeShape.refine(
  ({ startDate, endDate }) => {
    const difference =
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
    return difference >= 0 && difference <= 30;
  },
  { message: 'Date range must be between 0 and 30 days' },
);
export const GenerateSlotsSchema = DateRangeSchema;

export const BlockDateSchema = z.object({
  date: DateStringSchema,
  reason: z.string().trim().max(1000).optional(),
});
export const BlockedDateParamsSchema = z.object({ date: DateStringSchema });

export const AppointmentFilterSchema = z
  .object({
    status: AppointmentStatusEnum.optional(),
    date: DateStringSchema.optional(),
    startDate: DateStringSchema.optional(),
    endDate: DateStringSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
  })
  .refine((value) => !(value.date !== undefined && value.startDate !== undefined), {
    message: 'Use either date or a date range',
  })
  .refine((value) => (value.startDate === undefined) === (value.endDate === undefined), {
    message: 'Both startDate and endDate are required for a date range',
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.startDate <= value.endDate,
    { message: 'startDate must not be after endDate' },
  );

export const BarberAppointmentStatusEnum = z.enum([
  'CONFIRMED',
  'CANCELLED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'NO_SHOW',
]);
export const UpdateAppointmentStatusSchema = z.object({
  status: BarberAppointmentStatusEnum,
  notes: z.string().trim().max(1000).optional(),
});

export const PublicSlotsQuerySchema = z
  .object({
    date: DateStringSchema.optional(),
    days: z.coerce.number().int().min(1).max(30).default(7),
    mobileService: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    travelMinutes: z.coerce.number().int().min(1).max(240).optional(),
  })
  .superRefine((value, context) => {
    if (value.mobileService === true && value.travelMinutes === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['travelMinutes'],
        message: 'travelMinutes is required for mobile slot filtering',
      });
    }
  });
