import type { Paginated } from './types';
import { listFromResponse } from './types';

/**
 * Which page to ask for after this one, or `undefined` when the list is complete.
 *
 * Worth its own function because both ways of getting it wrong are quiet. Stopping a page early
 * hides rows with nothing on screen to say so — which is the bug this paging work exists to fix.
 * Failing to stop asks the server for pages past the end, forever, as fast as the reader scrolls.
 */
export const nextPageParam = <T>(lastPage: Paginated<T>): number | undefined => {
  const pagination = lastPage.pagination;
  // Endpoints that answer without a pagination block return everything they have in one go.
  if (pagination === undefined) return undefined;
  if (!Number.isFinite(pagination.page) || !Number.isFinite(pagination.totalPages))
    return undefined;
  return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
};

/** Every row across the pages fetched so far, in the order the server returned them. */
export const flattenPages = <T>(pages: readonly Paginated<T>[] | undefined): T[] =>
  (pages ?? []).flatMap((page) => listFromResponse(page));
