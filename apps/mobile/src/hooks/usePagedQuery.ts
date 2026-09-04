import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { flattenPages, nextPageParam } from '@/lib/paging';
import type { Paginated } from '@/lib/types';

export type PagedFilters = Record<string, string | number | boolean | undefined>;

export type PagedQueryResult<T> = {
  /** Every row fetched so far, in order, flattened across pages. */
  items: T[];
  /** How many rows exist server-side, when the endpoint reports it. */
  total: number | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
};

/**
 * Reads a paginated endpoint a page at a time.
 *
 * Every list endpoint in this API is paginated and defaults to 20 rows, but the screens used to
 * fire a single un-paged request and render whatever came back — so a barber with more than 20
 * bookings simply could not see the rest of them, and nothing on screen said so. This walks the
 * pages, and pairs with `PagedList` so only the visible rows are mounted.
 *
 * An endpoint that answers without a `pagination` block is treated as a single complete page,
 * which keeps this usable for the smaller collections that never grew one.
 */
export const usePagedQuery = <T, F extends object = PagedFilters>(
  queryKey: readonly unknown[],
  fetchPage: (filters: F & { page: number }) => Promise<Paginated<T>>,
  filters: F,
  options: { enabled?: boolean; staleTime?: number } = {},
): PagedQueryResult<T> => {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, filters],
    queryFn: ({ pageParam }) => fetchPage({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
  });

  const pages = query.data?.pages;
  const items = useMemo(() => flattenPages(pages), [pages]);

  return {
    items,
    total: pages?.[0]?.pagination?.total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: (): void => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: (): void => void query.refetch(),
  };
};
