/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type { LocationPingRequest } from '@barber-saas/shared-types';

import { query, withTransaction } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import { getTravelMetrics } from '../mobile/travelEstimateService';

type Row = Record<string, unknown>;
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

export const recordBarberLocation = async (
  barberUserId: string,
  appointmentId: string,
  input: LocationPingRequest,
) =>
  withTransaction(async (client) => {
    const appointments = await query<Row>(
      `SELECT a.id,a.status,a.barber_id
       FROM appointments a
       JOIN barber_profiles bp ON bp.id=a.barber_id
       WHERE a.id=$1 AND bp.user_id=$2
       FOR UPDATE`,
      [appointmentId, barberUserId],
      client,
    );
    const appointment = appointments[0];
    if (appointment === undefined) {
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    }
    if (String(appointment.status) !== 'ON_THE_WAY') {
      throw new AppError(
        400,
        'Location tracking is only active while the barber is on the way.',
        'TRACKING_NOT_ACTIVE',
      );
    }
    const inserted = await query<Row>(
      `INSERT INTO barber_location_pings
        (appointment_id,barber_id,latitude,longitude,accuracy_meters,heading_degrees,speed_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING recorded_at`,
      [
        appointmentId,
        appointment.barber_id,
        input.latitude,
        input.longitude,
        input.accuracyMeters ?? null,
        input.headingDegrees ?? null,
        input.speedMs ?? null,
      ],
      client,
    );
    await client.query(
      `DELETE FROM barber_location_pings
       WHERE appointment_id=$1 AND id IN (
         SELECT id FROM barber_location_pings
         WHERE appointment_id=$1
         ORDER BY recorded_at DESC,id DESC OFFSET 50
       )`,
      [appointmentId],
    );
    return { recorded: true, at: iso(inserted[0]?.recorded_at) };
  });

export const startBarberJourney = async (
  barberUserId: string,
  appointmentId: string,
  input: LocationPingRequest,
) =>
  withTransaction(async (client) => {
    const appointments = await query<Row>(
      `SELECT a.*
       FROM appointments a
       JOIN barber_profiles bp ON bp.id=a.barber_id
       WHERE a.id=$1 AND bp.user_id=$2
       FOR UPDATE`,
      [appointmentId, barberUserId],
      client,
    );
    const appointment = appointments[0];
    if (appointment === undefined) {
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    }
    if (appointment.is_mobile_service !== true) {
      throw new AppError(
        400,
        'Journey tracking is only available for mobile appointments.',
        'INVALID_STATUS_FOR_APPOINTMENT_TYPE',
      );
    }
    const currentStatus = String(appointment.status);
    if (currentStatus !== 'CONFIRMED' && currentStatus !== 'ON_THE_WAY') {
      throw new AppError(
        400,
        `Cannot start a journey from ${currentStatus}.`,
        'INVALID_STATUS_TRANSITION',
      );
    }
    let departedAt =
      appointment.barber_departed_at === null ? null : iso(appointment.barber_departed_at);
    if (currentStatus === 'CONFIRMED') {
      const updated = await query<Row>(
        `UPDATE appointments
         SET status='ON_THE_WAY',barber_departed_at=CURRENT_TIMESTAMP
         WHERE id=$1
         RETURNING barber_departed_at`,
        [appointmentId],
        client,
      );
      departedAt = iso(updated[0]?.barber_departed_at);
      const message = 'Your barber is on the way!';
      await client.query(
        `INSERT INTO notifications (user_id,type,title,message,related_data)
         VALUES ($1,'APPOINTMENT_REMINDER',$2::text,$2::text,$3::jsonb)`,
        [appointment.client_id, message, JSON.stringify({ appointmentId })],
      );
    } else if (departedAt === null) {
      const updated = await query<Row>(
        `UPDATE appointments
         SET barber_departed_at=CURRENT_TIMESTAMP
         WHERE id=$1
         RETURNING barber_departed_at`,
        [appointmentId],
        client,
      );
      departedAt = iso(updated[0]?.barber_departed_at);
    }
    const inserted = await query<Row>(
      `INSERT INTO barber_location_pings
        (appointment_id,barber_id,latitude,longitude,accuracy_meters,heading_degrees,speed_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING recorded_at`,
      [
        appointmentId,
        appointment.barber_id,
        input.latitude,
        input.longitude,
        input.accuracyMeters ?? null,
        input.headingDegrees ?? null,
        input.speedMs ?? null,
      ],
      client,
    );
    await client.query(
      `DELETE FROM barber_location_pings
       WHERE appointment_id=$1 AND id IN (
         SELECT id FROM barber_location_pings
         WHERE appointment_id=$1
         ORDER BY recorded_at DESC,id DESC OFFSET 50
       )`,
      [appointmentId],
    );
    const lastPingAt = iso(inserted[0]?.recorded_at);
    return {
      appointment: { id: appointmentId, status: 'ON_THE_WAY' as const, departedAt },
      tracking: { active: true as const, lastPingAt },
    };
  });

export const getLatestBarberLocation = async (clientId: string, appointmentId: string) => {
  const rows = await query<Row>(
    `SELECT a.id,a.status,a.barber_arrived_at,a.service_latitude,a.service_longitude,
      u.first_name AS barber_first_name,p.latitude,p.longitude,p.heading_degrees,p.recorded_at
     FROM appointments a
     JOIN barber_profiles bp ON bp.id=a.barber_id
     JOIN users u ON u.id=bp.user_id
     LEFT JOIN LATERAL (
       SELECT latitude,longitude,heading_degrees,recorded_at
       FROM barber_location_pings
       WHERE appointment_id=a.id
       ORDER BY recorded_at DESC,id DESC LIMIT 1
     ) p ON true
     WHERE a.id=$1 AND a.client_id=$2`,
    [appointmentId, clientId],
  );
  const row = rows[0];
  if (row === undefined) throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
  if (row.status === 'ARRIVED' || row.status === 'IN_PROGRESS') {
    return {
      isTracking: false,
      reason: row.status === 'ARRIVED' ? 'Barber has arrived' : 'Service is in progress',
      arrivedAt: row.barber_arrived_at === null ? null : iso(row.barber_arrived_at),
    };
  }
  if (row.status !== 'ON_THE_WAY') {
    return { isTracking: false, reason: 'Barber has not started the journey yet' };
  }
  if (row.recorded_at === null || row.recorded_at === undefined) {
    return { isTracking: false, reason: 'Waiting for the barber location' };
  }
  const metrics = await getTravelMetrics(
    { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    { latitude: Number(row.service_latitude), longitude: Number(row.service_longitude) },
  );
  const recordedAt = iso(row.recorded_at);
  return {
    isTracking: true,
    appointmentId,
    barberName: row.barber_first_name,
    lastPing: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      headingDegrees: row.heading_degrees === null ? null : Number(row.heading_degrees),
      recordedAt,
      secondsAgo: Math.max(0, Math.floor((Date.now() - new Date(recordedAt).getTime()) / 1000)),
    },
    estimatedArrivalMinutes: metrics.travelMinutes,
    distanceRemainingMiles: metrics.distanceMiles,
  };
};
