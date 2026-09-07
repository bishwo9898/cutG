import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { findBarberInCache } from '@/lib/barberCache';
import { usePagedQuery } from '@/hooks/usePagedQuery';
import type { PagedFilters, PagedQueryResult } from '@/hooks/usePagedQuery';
import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import type {
  AvailabilitySlot,
  BarberProfile,
  BarberService,
  Paginated,
  PublicBarber,
  Review,
} from '@/lib/types';

export type BarberSearchParams = Record<string, string | number | boolean | undefined>;

export const useBarberSearch = (
  params: BarberSearchParams,
): UseQueryResult<Paginated<PublicBarber>> =>
  useQuery({
    queryKey: ['barbers', 'search', params],
    queryFn: () => mobileApi.discovery.search(params),
  });

/** Walks every page of discovery results. See `usePagedQuery`. */
export const usePagedBarberSearch = (params: PagedFilters): PagedQueryResult<PublicBarber> =>
  usePagedQuery(['barbers', 'search', 'paged'], mobileApi.discovery.search, params);

export const useBarberProfile = (barberId: string): UseQueryResult<BarberProfile> => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['barbers', barberId],
    queryFn: () => mobileApi.discovery.profile(barberId),
    enabled: barberId.length > 0,
    // Open on the row the customer just tapped instead of a full-screen "Loading profile". It is
    // placeholderData rather than initialData on purpose: this is a partial profile, so the real
    // request must still run, and the screen can tell the difference via isPlaceholderData.
    placeholderData: () =>
      findBarberInCache(
        queryClient.getQueriesData({ queryKey: ['barbers'] }).map(([, data]) => data),
        barberId,
      ),
  });
};

export const useBarberServices = (barberId: string): UseQueryResult<Paginated<BarberService>> =>
  useQuery({
    queryKey: ['barbers', barberId, 'services'],
    queryFn: () => mobileApi.discovery.services(barberId),
    enabled: barberId.length > 0,
  });

export const useBarberSlots = (
  barberId: string,
  date?: string,
  options: BarberSearchParams = {},
): UseQueryResult<Paginated<AvailabilitySlot>> =>
  useQuery({
    queryKey: ['barbers', barberId, 'slots', date, options],
    queryFn: () =>
      mobileApi.discovery.slots(barberId, {
        ...(date === undefined ? {} : { date }),
        ...options,
      }),
    enabled: barberId.length > 0,
    staleTime: 30_000,
  });

export const useBarberReviews = (barberId: string): UseQueryResult<Paginated<Review>> =>
  useQuery({
    queryKey: ['barbers', barberId, 'reviews'],
    queryFn: () => mobileApi.discovery.reviews(barberId),
    enabled: barberId.length > 0,
  });

export const useSaveBarber = (): UseMutationResult<{ saved: boolean }, Error, string> =>
  useMutation({
    mutationFn: (barberId: string) => mobileApi.client.saveBarber(barberId),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['client', 'saved-barbers'] });
    },
  });

export const useRemoveSavedBarber = (): UseMutationResult<{ removed: boolean }, Error, string> =>
  useMutation({
    mutationFn: (barberId: string) => mobileApi.client.removeSavedBarber(barberId),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['client', 'saved-barbers'] });
    },
  });
