import { z } from 'zod';

import { UserTypeEnum } from './enums';

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,19}$/, 'Phone number format is invalid.');

export const SyncRequestSchema = z.object({
  userType: z.enum(['CLIENT', 'BARBER']),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export const UpdateProfileRequestSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: PhoneSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field is required.',
  });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const AuthUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  userType: UserTypeEnum,
  emailVerified: z.boolean(),
});
export type AuthUserSummary = z.infer<typeof AuthUserSummarySchema>;

export const AuthUserSchema = AuthUserSummarySchema.extend({
  phone: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
