import { z } from 'zod';

export const CreatePaymentIntentSchema = z.object({
  appointmentId: z.string().uuid(),
});
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentSchema>;

export const RefundRequestSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type RefundRequest = z.infer<typeof RefundRequestSchema>;

export const SubscriptionCheckoutSchema = z.object({
  tier: z.enum(['BASIC', 'PREMIUM']),
  interval: z.enum(['month', 'year']),
});
export type SubscriptionCheckoutRequest = z.infer<typeof SubscriptionCheckoutSchema>;

export const PaymentStatusFilterEnum = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']);
export type PaymentStatusFilter = z.infer<typeof PaymentStatusFilterEnum>;

export const EarningsPeriodEnum = z.enum(['week', 'month', 'all']).default('month');
export type EarningsPeriod = z.infer<typeof EarningsPeriodEnum>;

export const EarningsQuerySchema = z.object({
  period: EarningsPeriodEnum,
});

export const PaymentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
