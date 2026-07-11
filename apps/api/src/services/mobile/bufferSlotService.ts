import type { DatabaseExecutor } from '../../db/queries/barber.queries';
import { query } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import { calculateTravelBufferSlots, getTravelBufferSlotTimes } from '../../utils/travelBuffer';

type Row = Record<string, unknown>;
const date = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export const lockTravelBufferSlots = async (
  barberId: string,
  appointmentDate: string,
  appointmentStartTime: string,
  travelMinutes: number,
  slotDurationMinutes: number,
  executor: DatabaseExecutor,
): Promise<Row[]> => {
  const bufferCount = calculateTravelBufferSlots(travelMinutes, slotDurationMinutes);
  const required = getTravelBufferSlotTimes(
    appointmentDate,
    appointmentStartTime,
    bufferCount,
    slotDurationMinutes,
  );
  if (required.length === 0) return [];

  const values: unknown[] = [barberId];
  const clauses = required.map((slot) => {
    values.push(slot.date, slot.startTime);
    return `(slot_date = $${values.length - 1} AND start_time = $${values.length}::time)`;
  });
  const rows = await query<Row>(
    `SELECT * FROM availability_slots
     WHERE barber_id = $1 AND (${clauses.join(' OR ')})
     ORDER BY slot_date,start_time FOR UPDATE`,
    values,
    executor,
  );
  const allAvailable = required.every((requiredSlot) =>
    rows.some(
      (row) =>
        date(row.slot_date) === requiredSlot.date &&
        String(row.start_time).slice(0, 5) === requiredSlot.startTime &&
        row.status === 'AVAILABLE' &&
        row.is_travel_buffer !== true,
    ),
  );
  if (!allAvailable) {
    throw new AppError(
      400,
      'Not enough available time before this slot to accommodate travel. Please choose a later slot.',
      'BUFFER_SLOTS_UNAVAILABLE',
    );
  }
  return rows;
};

export const blockTravelBufferSlots = async (
  appointmentId: string,
  slots: Row[],
  executor: DatabaseExecutor,
): Promise<void> => {
  if (slots.length === 0) return;
  await query(
    `UPDATE availability_slots SET status='BOOKED',is_travel_buffer=true,travel_buffer_for=$1
     WHERE id = ANY($2::uuid[]) AND status='AVAILABLE'`,
    [appointmentId, slots.map((slot) => slot.id)],
    executor,
  );
};

export const releaseTravelBufferSlots = async (
  appointmentId: string,
  executor: DatabaseExecutor,
): Promise<void> => {
  await query(
    `UPDATE availability_slots SET status='AVAILABLE',is_travel_buffer=false,travel_buffer_for=NULL
     WHERE travel_buffer_for=$1 AND is_travel_buffer=true`,
    [appointmentId],
    executor,
  );
};
