import type { DatabaseExecutor } from '../../db/queries/barber.queries';
import { query } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import {
  calculateTravelBufferSlots,
  getReturnTravelBufferSlotTimes,
  getTravelBufferSlotTimes,
} from '../../utils/travelBuffer';

type Row = Record<string, unknown>;
type BufferKind = 'OUTBOUND' | 'RETURN';
type RequiredSlot = { date: string; startTime: string; bufferKind: BufferKind };
const date = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

const lockRequiredSlots = async (
  barberId: string,
  required: RequiredSlot[],
  executor: DatabaseExecutor,
): Promise<Row[]> => {
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
  const rowsWithKind = rows.map((row) => {
    const matching = required.find(
      (requiredSlot) =>
        date(row.slot_date) === requiredSlot.date &&
        String(row.start_time).slice(0, 5) === requiredSlot.startTime,
    );
    return { ...row, bufferKind: matching?.bufferKind };
  });
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
  return rowsWithKind;
};

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
  ).map((slot): RequiredSlot => ({ ...slot, bufferKind: 'OUTBOUND' }));
  return lockRequiredSlots(barberId, required, executor);
};

export const lockMobileTravelBufferSlots = async (
  barberId: string,
  appointmentDate: string,
  appointmentStartTime: string,
  appointmentEndTime: string,
  travelMinutes: number,
  slotDurationMinutes: number,
  executor: DatabaseExecutor,
): Promise<Row[]> => {
  const bufferCount = calculateTravelBufferSlots(travelMinutes, slotDurationMinutes);
  const outbound = getTravelBufferSlotTimes(
    appointmentDate,
    appointmentStartTime,
    bufferCount,
    slotDurationMinutes,
  ).map((slot): RequiredSlot => ({ ...slot, bufferKind: 'OUTBOUND' }));
  const returning = getReturnTravelBufferSlotTimes(
    appointmentDate,
    appointmentEndTime,
    bufferCount,
    slotDurationMinutes,
  ).map((slot): RequiredSlot => ({ ...slot, bufferKind: 'RETURN' }));
  return lockRequiredSlots(barberId, [...outbound, ...returning], executor);
};

export const blockTravelBufferSlots = async (
  appointmentId: string,
  slots: Row[],
  executor: DatabaseExecutor,
): Promise<void> => {
  if (slots.length === 0) return;
  const outbound = slots.filter((slot) => slot.bufferKind !== 'RETURN').map((slot) => slot.id);
  const returning = slots.filter((slot) => slot.bufferKind === 'RETURN').map((slot) => slot.id);
  const updateKind = async (ids: unknown[], kind: BufferKind): Promise<void> => {
    if (ids.length === 0) return;
    await query(
      `UPDATE availability_slots
       SET status='BOOKED',is_travel_buffer=true,travel_buffer_for=$1,travel_buffer_kind=$3
       WHERE id = ANY($2::uuid[]) AND status='AVAILABLE'`,
      [appointmentId, ids, kind],
      executor,
    );
  };
  await updateKind(outbound, 'OUTBOUND');
  await updateKind(returning, 'RETURN');
};

export const releaseTravelBufferSlots = async (
  appointmentId: string,
  executor: DatabaseExecutor,
): Promise<void> => {
  await query(
    `UPDATE availability_slots
     SET status='AVAILABLE',is_travel_buffer=false,travel_buffer_for=NULL,travel_buffer_kind=NULL
     WHERE travel_buffer_for=$1 AND is_travel_buffer=true`,
    [appointmentId],
    executor,
  );
};
