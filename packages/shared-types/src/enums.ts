import { z } from 'zod';

export const UserTypeEnum = z.enum(['BARBER', 'CLIENT', 'ADMIN']);
export type UserType = z.infer<typeof UserTypeEnum>;

export const SubscriptionTierEnum = z.enum(['FREE', 'BASIC', 'PREMIUM']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierEnum>;

export const SlotStatusEnum = z.enum(['AVAILABLE', 'BOOKED', 'BLOCKED']);
export type SlotStatus = z.infer<typeof SlotStatusEnum>;

export const AppointmentStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusEnum>;

export const PaymentStatusEnum = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const SubscriptionStatusEnum = z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>;

export const NotificationTypeEnum = z.enum([
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_CANCELLED',
  'REVIEW_REQUEST',
  'SUBSCRIPTION_RENEWAL',
  'SUBSCRIPTION_EXPIRING',
  'PROMOTION',
  'SYSTEM',
]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;
