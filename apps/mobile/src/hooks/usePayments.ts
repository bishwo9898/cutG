import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { BarberPaymentPreferences } from '@barber-saas/shared-types';

import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import type {
  EarningsSummary,
  PaymentIntentResponse,
  PaymentStatusResponse,
  StripeConnectStatus,
  SubscriptionSummary,
} from '@/lib/types';

export const usePaymentStatus = (appointmentId: string): UseQueryResult<PaymentStatusResponse> =>
  useQuery({
    queryKey: ['payments', appointmentId],
    queryFn: () => mobileApi.payments.appointmentStatus(appointmentId),
    enabled: appointmentId.length > 0,
  });

export const useCreatePaymentIntent = (): UseMutationResult<PaymentIntentResponse, Error, string> =>
  useMutation({
    mutationFn: (appointmentId: string) => mobileApi.payments.createIntent(appointmentId),
  });

export const useRefundPayment = (): UseMutationResult<PaymentStatusResponse, Error, string> =>
  useMutation({
    mutationFn: (appointmentId: string) => mobileApi.payments.refund(appointmentId),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

export const useStripeStatus = (): UseQueryResult<StripeConnectStatus> =>
  useQuery({ queryKey: ['barber', 'stripe'], queryFn: () => mobileApi.barber.stripeStatus() });

export const useConnectStripe = (): UseMutationResult<StripeConnectStatus, Error, void> =>
  useMutation({
    mutationFn: () => mobileApi.barber.connectStripe(),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'online-payments'] });
    },
  });

export const usePaymentPreferences = (): UseQueryResult<BarberPaymentPreferences> =>
  useQuery({
    queryKey: ['barber', 'online-payments'],
    queryFn: () => mobileApi.barber.paymentPreferences(),
  });

export const useUpdatePaymentPreferences = (): UseMutationResult<
  BarberPaymentPreferences,
  Error,
  boolean
> =>
  useMutation({
    mutationFn: (enabled) => mobileApi.barber.updatePaymentPreferences(enabled),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'online-payments'] });
    },
  });

export const useEarnings = (period: string, enabled = true): UseQueryResult<EarningsSummary> =>
  useQuery({
    queryKey: ['barber', 'earnings', period],
    queryFn: () => mobileApi.barber.earnings(period),
    enabled,
  });

export const useSubscription = (enabled = true): UseQueryResult<SubscriptionSummary> =>
  useQuery({
    queryKey: ['barber', 'subscription'],
    queryFn: () => mobileApi.barber.subscription(),
    enabled,
  });
