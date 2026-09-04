import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { BookAppointmentRequest, CreateReviewRequest } from '@barber-saas/shared-types';

import { usePagedQuery } from '@/hooks/usePagedQuery';
import type { PagedFilters, PagedQueryResult } from '@/hooks/usePagedQuery';
import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import type { AppointmentSummary, BarberLocation, Paginated, Review } from '@/lib/types';

export type AppointmentFilters = Record<string, string | number | boolean | undefined>;

export const useClientAppointments = (
  filters: AppointmentFilters,
): UseQueryResult<Paginated<AppointmentSummary>> =>
  useQuery({
    queryKey: ['appointments', 'client', filters],
    queryFn: () => mobileApi.client.appointments(filters),
  });

/** Walks every page of the customer's bookings. See `usePagedQuery`. */
export const usePagedClientAppointments = (
  filters: PagedFilters,
): PagedQueryResult<AppointmentSummary> =>
  usePagedQuery(['appointments', 'client', 'paged'], mobileApi.client.appointments, filters);

export const useClientAppointment = (appointmentId: string): UseQueryResult<AppointmentSummary> =>
  useQuery({
    queryKey: ['appointments', 'client', appointmentId],
    queryFn: () => mobileApi.client.appointment(appointmentId),
    enabled: appointmentId.length > 0,
  });

export const useBarberLocation = (
  appointmentId: string,
  active: boolean,
): UseQueryResult<BarberLocation> =>
  useQuery({
    queryKey: ['appointments', 'barber-location', appointmentId],
    queryFn: () => mobileApi.client.barberLocation(appointmentId),
    enabled: active && appointmentId.length > 0,
    refetchInterval: active ? 5_000 : false,
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
