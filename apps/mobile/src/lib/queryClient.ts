import { QueryClient } from '@tanstack/react-query';

/** How long a restored cache is still worth showing before the screen waits for the network. */
export const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      // Long enough that the working set survives being backgrounded, because whatever is still
      // in memory is what gets written to disk and restored on the next launch. At ten minutes
      // the cache evaporated while the phone sat in a pocket and every cold start was a spinner.
      // Queries are small JSON; the cost of keeping them is not the thing to optimise here.
      gcTime: CACHE_MAX_AGE_MS,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});
