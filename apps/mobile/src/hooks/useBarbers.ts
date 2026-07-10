import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

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

export const useBarberProfile = (barberId: string): UseQueryResult<BarberProfile> =>
  useQuery({
    queryKey: ['barbers', barberId],
    queryFn: () => mobileApi.discovery.profile(barberId),
    enabled: barberId.length > 0,
  });

export const useBarberServices = (barberId: string): UseQueryResult<Paginated<BarberService>> =>
  useQuery({
    queryKey: ['barbers', barberId, 'services'],
    queryFn: () => mobileApi.discovery.services(barberId),
    enabled: barberId.length > 0,
  });

export const useBarberSlots = (
  barberId: string,
  date?: string,
): UseQueryResult<Paginated<AvailabilitySlot>> =>
  useQuery({
    queryKey: ['barbers', barberId, 'slots', date],
    queryFn: () => mobileApi.discovery.slots(barberId, date === undefined ? undefined : { date }),
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
