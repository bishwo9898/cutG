import { z } from 'zod';

import { UserTypeEnum } from './enums';

export const PasswordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(72, 'Password must contain at most 72 characters.');

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,19}$/, 'Phone number format is invalid.');

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  userType: z.enum(['CLIENT', 'BARBER']),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  email: z.string().email(),
  verificationCode: z.string().length(6),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const ResendVerificationRequestSchema = z.object({
  email: z.string().email(),
});
export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

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

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
  resetCode: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const AuthUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  userType: UserTypeEnum,
  emailVerified: z.boolean(),
});
export type AuthUserSummary = z.infer<typeof AuthUserSummarySchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  user: AuthUserSummarySchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const AuthUserSchema = AuthUserSummarySchema.extend({
  phone: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
