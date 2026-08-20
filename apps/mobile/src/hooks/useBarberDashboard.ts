import { format } from 'date-fns';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import type { UpdateServiceRequest } from '@barber-saas/shared-types';

import type {
  AppointmentSummary,
  AvailabilitySlot,
  BarberProfile,
  BarberService,
  Paginated,
} from '@/lib/types';
import type { BarberAppointmentDetail } from '@barber-saas/shared-types';

export const todayDate = (): string => format(new Date(), 'yyyy-MM-dd');

export const useTodayAppointments = (): UseQueryResult<Paginated<AppointmentSummary>> =>
  useQuery({
    queryKey: ['barber', 'appointments', 'today'],
    queryFn: () => mobileApi.barber.appointments({ date: todayDate() }),
    refetchInterval: 60_000,
  });

export const useBarberAppointments = (
  filters: Record<string, string | number | boolean | undefined>,
): UseQueryResult<Paginated<AppointmentSummary>> =>
  useQuery({
    queryKey: ['barber', 'appointments', filters],
    queryFn: () => mobileApi.barber.appointments(filters),
  });

export const useBarberAppointment = (
  appointmentId: string,
): UseQueryResult<BarberAppointmentDetail> =>
  useQuery({
    queryKey: ['barber', 'appointments', 'detail', appointmentId],
    queryFn: () => mobileApi.barber.appointment(appointmentId),
    enabled: appointmentId.length > 0,
  });

export const useBarberSlotsPrivate = (
  filters: Record<string, string | number | boolean | undefined>,
): UseQueryResult<Paginated<AvailabilitySlot>> =>
  useQuery({
    queryKey: ['barber', 'slots', filters],
    queryFn: () => mobileApi.barber.slots(filters),
    staleTime: 30_000,
  });

export const useBarberProfilePrivate = (): UseQueryResult<BarberProfile> =>
  useQuery({ queryKey: ['barber', 'profile'], queryFn: () => mobileApi.barber.profile() });

export const useBarberServicesPrivate = (): UseQueryResult<Paginated<BarberService>> =>
  useQuery({ queryKey: ['barber', 'services'], queryFn: () => mobileApi.barber.services() });

export const useUpdateAppointmentStatus = (): UseMutationResult<
  AppointmentSummary,
  Error,
  { id: string; status: string; notes?: string }
> =>
  useMutation({
    mutationFn: ({ id, status, notes }) =>
      mobileApi.barber.updateAppointmentStatus(id, { status, notes }),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'appointments'] });
    },
  });

export const useUpdateService = (): UseMutationResult<
  BarberService,
  Error,
  { id: string; body: UpdateServiceRequest }
> =>
  useMutation({
    mutationFn: ({ id, body }) => mobileApi.barber.updateService(id, body),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'services'] });
    },
  });
