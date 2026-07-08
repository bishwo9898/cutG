import { z } from 'zod';

import {
  AppointmentStatusEnum,
  NotificationTypeEnum,
  PaymentStatusEnum,
  SlotStatusEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  UserTypeEnum,
} from './enums';

const NullableDateSchema = z.date().nullable();
const NullableStringSchema = z.string().nullable();
const NullableNumberSchema = z.number().nullable();
const JsonRecordSchema = z.record(z.unknown()).default({});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  phone: NullableStringSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  userType: UserTypeEnum,
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  emailVerifiedAt: NullableDateSchema,
  metadata: JsonRecordSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: NullableDateSchema,
});
export type User = z.infer<typeof UserSchema>;

export const BarberProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  businessName: z.string().min(1),
  bio: NullableStringSchema,
  yearsOfExperience: z.number().int().nonnegative().nullable(),
  averageRating: z.number().min(0).max(5),
  totalReviews: z.number().int().nonnegative(),
  totalClients: z.number().int().nonnegative(),
  latitude: NullableNumberSchema,
  longitude: NullableNumberSchema,
  address: NullableStringSchema,
  city: NullableStringSchema,
  state: NullableStringSchema,
  zipCode: NullableStringSchema,
  profilePhotoUrl: z.string().url().nullable(),
  profilePhotoKey: NullableStringSchema,
  subscriptionTier: SubscriptionTierEnum,
  subscriptionValidUntil: NullableDateSchema,
  stripeAccountId: NullableStringSchema,
  isVerified: z.boolean(),
  verifiedAt: NullableDateSchema,
  metadata: JsonRecordSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type BarberProfile = z.infer<typeof BarberProfileSchema>;

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  barberId: z.string().uuid(),
  name: z.string().min(1),
  description: NullableStringSchema,
  price: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  category: z.string().min(1),
  isActive: z.boolean(),
  metadata: JsonRecordSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const AvailabilitySlotSchema = z.object({
  id: z.string().uuid(),
  barberId: z.string().uuid(),
  slotDate: z.date(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().int().positive(),
  status: SlotStatusEnum,
  appointmentId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  availabilitySlotId: z.string().uuid().nullable(),
  scheduledAt: z.date(),
  durationMinutes: z.number().int().positive(),
  status: AppointmentStatusEnum,
  paymentStatus: PaymentStatusEnum,
  locationAddress: z.string().min(1),
  locationLatitude: NullableNumberSchema,
  locationLongitude: NullableNumberSchema,
  priceQuoted: z.number().positive(),
  pricePaid: z.number().positive().nullable(),
  clientNotes: NullableStringSchema,
  barberNotes: NullableStringSchema,
  cancellationReason: NullableStringSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  confirmedAt: NullableDateSchema,
  completedAt: NullableDateSchema,
  cancelledAt: NullableDateSchema,
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  stripePaymentIntentId: NullableStringSchema,
  stripeChargeId: NullableStringSchema,
  status: PaymentStatusEnum,
  refundAmountCents: z.number().int().nonnegative().nullable(),
  refundReason: NullableStringSchema,
  refundStripeId: NullableStringSchema,
  lastErrorMessage: NullableStringSchema,
  errorDetails: z.record(z.unknown()).nullable(),
  metadata: JsonRecordSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  refundedAt: NullableDateSchema,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const SubscriptionFeaturesSchema = z.object({
  maxServices: z.number().int().positive(),
  maxClients: z.number().int().positive(),
  advancedAnalytics: z.boolean(),
  aiRecommendations: z.boolean(),
});
export type SubscriptionFeatures = z.infer<typeof SubscriptionFeaturesSchema>;

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  barberId: z.string().uuid(),
  tier: SubscriptionTierEnum,
  status: SubscriptionStatusEnum,
  stripeSubscriptionId: NullableStringSchema,
  billingCycleStart: z.date(),
  billingCycleEnd: z.date(),
  renewalDate: NullableDateSchema,
  autoRenew: z.boolean(),
  features: SubscriptionFeaturesSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  cancelledAt: NullableDateSchema,
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: NullableStringSchema,
  comment: NullableStringSchema,
  isVerifiedAppointment: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationTypeEnum,
  title: z.string().min(1),
  message: z.string().min(1),
  relatedData: JsonRecordSchema,
  isRead: z.boolean(),
  readAt: NullableDateSchema,
  sentViaEmail: z.boolean(),
  sentViaSms: z.boolean(),
  sentViaPush: z.boolean(),
  createdAt: z.date(),
  scheduledFor: NullableDateSchema,
  sentAt: NullableDateSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;
