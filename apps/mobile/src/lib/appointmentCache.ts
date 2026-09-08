import type { AppointmentSummary, AppointmentStatus, Paginated } from './types';

/**
 * Applies a status change to every cached shape an appointment can be sitting in.
 *
 * Confirming a booking used to cost two round trips before anything moved on screen: the PATCH,
 * then the refetch its invalidation triggered. On a barber's phone between clients that reads as a
 * dead button, and it is the action they press most. Patching the cache first makes the change
 * land in the same frame; the refetch still happens, it just stops being the thing the barber
 * waits on.
 *
 * The same appointment lives in several caches at once — today's list, the paged list, its own
 * detail, and the slot grid that names it — and they are all differently shaped, so this walks
 * whatever it is given rather than knowing about any one of them.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Keys a paginated payload may carry its rows under. Mirrors `listFromResponse`. */
const ROW_KEYS = ['data', 'items', 'appointments', 'slots'] as const;

const patchOne = (row: unknown, id: string, status: AppointmentStatus): unknown => {
  if (!isRecord(row)) return row;

  // An appointment, in a list or on its own.
  if (row.id === id && 'status' in row) {
    return row.status === status ? row : { ...row, status };
  }

  // A slot naming the appointment it belongs to, as the barber's calendar renders it.
  const summary = row.appointmentSummary;
  if (isRecord(summary) && summary.appointmentId === id) {
    return summary.status === status ? row : { ...row, appointmentSummary: { ...summary, status } };
  }

  return row;
};

const patchRows = (rows: unknown, id: string, status: AppointmentStatus): unknown => {
  if (!Array.isArray(rows)) return rows;
  let changed = false;
  const next = rows.map((row) => {
    const patched = patchOne(row, id, status);
    if (patched !== row) changed = true;
    return patched;
  });
  // Returning the original array when nothing matched keeps React Query from treating this as new
  // data and re-rendering every list that happened to be cached.
  return changed ? next : rows;
};

export const patchAppointmentStatus = <T>(cached: T, id: string, status: AppointmentStatus): T => {
  if (!isRecord(cached)) return cached;

  // An infinite query: `{ pages: [...] }`.
  if (Array.isArray(cached.pages)) {
    let changed = false;
    const pages = cached.pages.map((page) => {
      const patched = patchAppointmentStatus(page, id, status);
      if (patched !== page) changed = true;
      return patched;
    });
    return changed ? ({ ...cached, pages } as T) : cached;
  }

  // A single appointment, as the detail screen holds it.
  const single = patchOne(cached, id, status);
  if (single !== cached) return single as T;

  // A paginated payload, under whichever key this endpoint uses.
  for (const key of ROW_KEYS) {
    const rows = cached[key];
    if (!Array.isArray(rows)) continue;
    const patched = patchRows(rows, id, status);
    if (patched !== rows) return { ...cached, [key]: patched } as T;
  }

  return cached;
};

export type { AppointmentSummary, Paginated };
