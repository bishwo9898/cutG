import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { findBarberInCache, isBarberSaved, toggleSavedBarber } from '@/lib/barberCache';
import { usePagedQuery } from '@/hooks/usePagedQuery';
import type { PagedFilters, PagedQueryResult } from '@/hooks/usePagedQuery';
import { mobileApi } from '@/lib/apiClient';
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

const SAVED_KEY = ['client', 'saved-barbers'] as const;

/** The customer's saved barbers. Shared by the Saved tab and the heart on a barber's profile. */
export const useSavedBarbers = (): UseQueryResult<Paginated<PublicBarber>> =>
  useQuery({ queryKey: SAVED_KEY, queryFn: () => mobileApi.client.savedBarbers() });

type SaveChange = { barber: PublicBarber; save: boolean };

/**
 * The heart on a barber's profile.
 *
 * It used to only ever save: the outline never filled, so there was no way to tell whether the tap
 * had done anything, and pressing it again re-sent the same save — which the API rejects as a
 * duplicate. It reads the saved list now, toggles the right way, and moves the moment it is
 * pressed rather than after a round trip and the refetch behind it.
 */
export const useToggleSavedBarber = (): {
  isSaved: (barberId: string) => boolean;
  toggle: (barber: PublicBarber) => void;
} => {
  const queryClient = useQueryClient();
  const saved = useSavedBarbers();

  const mutation = useMutation<unknown, Error, SaveChange, { previous: unknown }>({
    mutationFn: ({ barber, save }) =>
      save ? mobileApi.client.saveBarber(barber.id) : mobileApi.client.removeSavedBarber(barber.id),
    onMutate: async ({ barber, save }): Promise<{ previous: unknown }> => {
      await queryClient.cancelQueries({ queryKey: SAVED_KEY });
      const previous = queryClient.getQueryData(SAVED_KEY);
      queryClient.setQueryData(SAVED_KEY, (current: unknown) =>
        toggleSavedBarber(current ?? { barbers: [] }, barber, save),
      );
      return { previous };
    },
    onError: (_error, _variables, context): void => {
      queryClient.setQueryData(SAVED_KEY, context?.previous);
    },
    onSettled: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: SAVED_KEY });
    },
  });

  return {
    isSaved: (barberId: string): boolean => isBarberSaved(saved.data, barberId),
    toggle: (barber: PublicBarber): void => {
      mutation.mutate({ barber, save: !isBarberSaved(saved.data, barber.id) });
    },
  };
};
