import { format } from 'date-fns';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { usePagedQuery } from '@/hooks/usePagedQuery';
import type { PagedFilters, PagedQueryResult } from '@/hooks/usePagedQuery';
import { mobileApi } from '@/lib/apiClient';
import { patchAppointmentStatus } from '@/lib/appointmentCache';
import { queryClient } from '@/lib/queryClient';
import type { UpdateBarberProfileRequest, UpdateServiceRequest } from '@barber-saas/shared-types';

import type {
  AppointmentSummary,
  AvailabilitySlot,
  BarberProfile,
  BarberService,
  Paginated,
  AppointmentStatus,
} from '@/lib/types';
import type { BarberAppointmentDetail } from '@barber-saas/shared-types';
import type { ScheduleEntry } from '@barber-saas/shared-types';

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

/** Walks every page of the barber's bookings. See `usePagedQuery`. */
export const usePagedBarberAppointments = (
  filters: PagedFilters,
): PagedQueryResult<AppointmentSummary> =>
  usePagedQuery(['barber', 'appointments', 'paged'], mobileApi.barber.appointments, filters);

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

export const useBarberSchedule = (): UseQueryResult<{ schedule: ScheduleEntry[] }> =>
  useQuery({ queryKey: ['barber', 'schedule'], queryFn: mobileApi.barber.schedule });

export const useUpdateBarberSchedule = (): UseMutationResult<
  { schedule: ScheduleEntry[] },
  Error,
  ScheduleEntry[]
> =>
  useMutation({
    mutationFn: (schedule: ScheduleEntry[]) => mobileApi.barber.updateSchedule(schedule),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'schedule'] });
    },
  });

export const useBlockBarberDate = (): UseMutationResult<
  { date: string },
  Error,
  { date: string; reason?: string }
> =>
  useMutation({
    mutationFn: ({ date, reason }: { date: string; reason?: string }) =>
      mobileApi.barber.blockDate(date, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'slots'] });
    },
  });

export const useBarberProfilePrivate = (): UseQueryResult<BarberProfile> =>
  useQuery({ queryKey: ['barber', 'profile'], queryFn: () => mobileApi.barber.profile() });

export const useUpdateBarberProfile = (): UseMutationResult<
  BarberProfile,
  Error,
  UpdateBarberProfileRequest
> =>
  useMutation({
    mutationFn: (body) => mobileApi.barber.updateProfile(body),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'profile'] });
    },
  });

export const useBarberServicesPrivate = (): UseQueryResult<Paginated<BarberService>> =>
  useQuery({ queryKey: ['barber', 'services'], queryFn: () => mobileApi.barber.services() });

type StatusChange = { id: string; status: string; notes?: string };
/** Snapshots of every cache this touched, so a failure can put them all back. */
type StatusRollback = { previous: Array<[readonly unknown[], unknown]> };

/**
 * Confirm, decline, start, complete — the actions a barber presses all day.
 *
 * The change is applied to the cache before the request goes out, so the badge flips in the same
 * frame instead of after a PATCH and the refetch its invalidation triggers. Two round trips of
 * dead button, on a phone between clients, was the worst-feeling thing in the portal.
 */
export const useUpdateAppointmentStatus = (): UseMutationResult<
  AppointmentSummary,
  Error,
  StatusChange,
  StatusRollback
> =>
  useMutation<AppointmentSummary, Error, StatusChange, StatusRollback>({
    mutationFn: ({ id, status, notes }) =>
      mobileApi.barber.updateAppointmentStatus(id, { status, notes }),

    onMutate: async ({ id, status }): Promise<StatusRollback> => {
      // In-flight refetches would otherwise land after the patch and put the old status back.
      await queryClient.cancelQueries({ queryKey: ['barber', 'appointments'] });
      await queryClient.cancelQueries({ queryKey: ['barber', 'slots'] });

      const touched: Array<[readonly unknown[], unknown]> = [];
      for (const key of [
        ['barber', 'appointments'],
        ['barber', 'slots'],
      ]) {
        for (const [queryKey, data] of queryClient.getQueriesData({ queryKey: key })) {
          const patched = patchAppointmentStatus(data, id, status as AppointmentStatus);
          // Only remember caches this actually changed; restoring the rest on failure would
          // discard anything that arrived in the meantime.
          if (patched !== data) {
            touched.push([queryKey, data]);
            queryClient.setQueryData(queryKey, patched);
          }
        }
      }
      return { previous: touched };
    },

    onError: (_error, _variables, context): void => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    // Reconcile either way: the server decides things the patch cannot, such as what a completed
    // booking does to the day's revenue.
    onSettled: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['barber', 'appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['barber', 'slots'] });
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
