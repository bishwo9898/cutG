import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { BookAppointmentRequest, CreateReviewRequest } from '@barber-saas/shared-types';

import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import type { AppointmentSummary, Paginated, Review } from '@/lib/types';

export type AppointmentFilters = Record<string, string | number | boolean | undefined>;

export const useClientAppointments = (
  filters: AppointmentFilters,
): UseQueryResult<Paginated<AppointmentSummary>> =>
  useQuery({
    queryKey: ['appointments', 'client', filters],
    queryFn: () => mobileApi.client.appointments(filters),
  });

export const useClientAppointment = (appointmentId: string): UseQueryResult<AppointmentSummary> =>
  useQuery({
    queryKey: ['appointments', 'client', appointmentId],
    queryFn: () => mobileApi.client.appointment(appointmentId),
    enabled: appointmentId.length > 0,
  });

export const useBookAppointment = (): UseMutationResult<
  AppointmentSummary,
  Error,
  BookAppointmentRequest
> =>
  useMutation({
    mutationFn: (body: BookAppointmentRequest) => mobileApi.client.bookAppointment(body),
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['barbers'] }),
      ]);
    },
  });

export const useCancelAppointment = (): UseMutationResult<AppointmentSummary, Error, string> =>
  useMutation({
    mutationFn: (appointmentId: string) => mobileApi.client.cancelAppointment(appointmentId),
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['barbers'] }),
      ]);
    },
  });

export const useCreateReview = (): UseMutationResult<Review, Error, CreateReviewRequest> =>
  useMutation({
    mutationFn: (body: CreateReviewRequest) => mobileApi.client.createReview(body),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
