import { describe, expect, it } from 'vitest';

import { flattenPages, nextPageParam } from './paging';
import type { Pagination } from './types';

const page = (
  page: number,
  totalPages: number,
  total = totalPages * 20,
): { appointments: never[]; pagination: Pagination } => ({
  appointments: [],
  pagination: { page, limit: 20, total, totalPages },
});

describe('nextPageParam', () => {
  it('asks for the next page while there is one', () => {
    expect(nextPageParam(page(1, 3))).toBe(2);
    expect(nextPageParam(page(2, 3))).toBe(3);
  });

  it('stops on the last page rather than requesting past the end forever', () => {
    expect(nextPageParam(page(3, 3))).toBeUndefined();
    expect(nextPageParam(page(1, 1))).toBeUndefined();
  });

  it('treats an empty result as complete', () => {
    expect(nextPageParam(page(1, 0, 0))).toBeUndefined();
  });

  it('treats a response with no pagination block as one complete page', () => {
    expect(nextPageParam({ appointments: [] })).toBeUndefined();
  });

  it('stops rather than looping when the server sends nonsense', () => {
    expect(
      nextPageParam({ pagination: { page: Number.NaN, limit: 20, total: 5, totalPages: 3 } }),
    ).toBeUndefined();
  });
});

describe('flattenPages', () => {
  it('joins the pages in order, whatever key the endpoint uses for its rows', () => {
    expect(
      flattenPages([
        { appointments: ['a', 'b'], pagination: { page: 1, limit: 2, total: 3, totalPages: 2 } },
        { appointments: ['c'], pagination: { page: 2, limit: 2, total: 3, totalPages: 2 } },
      ]),
    ).toEqual(['a', 'b', 'c']);
    expect(flattenPages([{ barbers: ['x'] }, { barbers: ['y'] }])).toEqual(['x', 'y']);
  });

  it('is empty before the first page arrives', () => {
    expect(flattenPages(undefined)).toEqual([]);
  });
});
