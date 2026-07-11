import { z } from 'zod';

export const FeeStructureEnum = z.enum(['flat', 'per_mile', 'free']);
export type FeeStructure = z.infer<typeof FeeStructureEnum>;

export const SetMobileConfigSchema = z
  .object({
    isEnabled: z.boolean(),
    serviceRadiusMiles: z.number().min(1).max(50),
    feeStructure: FeeStructureEnum,
    baseFeeCents: z.number().int().min(0).default(0),
    perMileRateCents: z.number().int().min(0).default(0),
    originLatitude: z.number().min(-90).max(90),
    originLongitude: z.number().min(-180).max(180),
    originAddress: z.string().trim().max(500).optional(),
    mobileServiceNotes: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, context) => {
    if (data.feeStructure === 'flat' && data.baseFeeCents <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseFeeCents'],
        message: 'Flat fee must be greater than zero',
      });
    }
    if (data.feeStructure === 'per_mile' && data.perMileRateCents <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['perMileRateCents'],
        message: 'Per-mile rate must be greater than zero',
      });
    }
  })
  .transform((data) =>
    data.feeStructure === 'free' ? { ...data, baseFeeCents: 0, perMileRateCents: 0 } : data,
  );
export type SetMobileConfigRequest = z.infer<typeof SetMobileConfigSchema>;

export const TravelEstimateSchema = z.object({
  barberId: z.string().uuid(),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
});
export type TravelEstimateRequest = z.infer<typeof TravelEstimateSchema>;

export const SaveAddressSchema = z.object({
  label: z.string().trim().min(1).max(50),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(50),
  zipCode: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).default('US'),
});
export type SaveAddressRequest = z.infer<typeof SaveAddressSchema>;

export const UpdateAddressSchema = SaveAddressSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field is required',
  },
);
export type UpdateAddressRequest = z.infer<typeof UpdateAddressSchema>;
export const AddressParamsSchema = z.object({ addressId: z.string().uuid() });

export const OneTimeAddressSchema = SaveAddressSchema.omit({ label: true });
export type OneTimeAddressRequest = z.infer<typeof OneTimeAddressSchema>;

export const BookMobileAppointmentExtensionSchema = z
  .object({
    isMobileService: z.boolean().default(false),
    clientAddressId: z.string().uuid().optional(),
    clientAddressOneTime: OneTimeAddressSchema.optional(),
  })
  .refine(
    (data) =>
      !data.isMobileService ||
      (data.clientAddressId !== undefined) !== (data.clientAddressOneTime !== undefined),
    { message: 'Provide exactly one address for mobile bookings' },
  );
