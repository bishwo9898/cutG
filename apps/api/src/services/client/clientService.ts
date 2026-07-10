/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type {
  BookAppointmentRequest,
  ClientAppointmentQuery,
  CreateReviewRequest,
} from '@barber-saas/shared-types';

import { query, withTransaction, type DatabaseExecutor } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';

type Row = Record<string, unknown>;

const date = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const time = (value: unknown): string => String(value).slice(0, 5);
const dateTime = (value: unknown): string =>
  value instanceof Date
    ? value.toISOString()
    : new Date(String(value).replace(' ', 'T')).toISOString();
const money = (value: unknown): number => Number(value);
const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const requireActiveBarber = async (barberId: string, executor?: DatabaseExecutor): Promise<Row> => {
  const rows = await query<Row>(
    `SELECT bp.*, u.is_active, u.deleted_at
     FROM barber_profiles bp
     JOIN users u ON u.id = bp.user_id
     WHERE bp.id = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
    [barberId],
    executor,
  );
  const barber = rows[0];
  if (barber === undefined) {
    throw new AppError(404, 'Barber profile does not exist.', 'BARBER_PROFILE_NOT_FOUND');
  }
  return barber;
};

const mapService = (row: Row) => ({
  id: row.service_id ?? row.id,
  name: row.service_name ?? row.name,
  price: row.price === undefined ? undefined : money(row.price),
  durationMinutes: row.service_duration_minutes ?? row.duration_minutes,
  category: row.category,
});

const mapAppointment = (row: Row) => ({
  id: row.id,
  scheduledAt: dateTime(row.scheduled_at),
  durationMinutes: row.duration_minutes,
  status: row.status,
  paymentStatus: row.payment_status,
  priceQuoted: money(row.price_quoted),
  clientNotes: row.client_notes,
  barberNotes: row.barber_notes,
  service: mapService(row),
  barber: {
    id: row.barber_id,
    businessName: row.business_name,
    profilePhotoUrl: row.profile_photo_url,
    city: row.city,
    address: row.location_address ?? row.address,
  },
  slot:
    row.availability_slot_id === null
      ? null
      : {
          id: row.availability_slot_id,
          date: date(row.slot_date),
          startTime: time(row.start_time),
          endTime: time(row.end_time),
        },
  review:
    row.review_id === null || row.review_id === undefined
      ? null
      : {
          id: row.review_id,
          rating: row.review_rating,
          title: row.review_title,
          comment: row.review_comment,
          createdAt: dateTime(row.review_created_at),
        },
});

const appointmentSelect = `
  SELECT
    a.*,
    s.id AS service_id,
    s.name AS service_name,
    s.price,
    s.duration_minutes AS service_duration_minutes,
    s.category,
    bp.business_name,
    bp.profile_photo_url,
    bp.city,
    bp.address,
    av.slot_date,
    av.start_time,
    av.end_time,
    r.id AS review_id,
    r.rating AS review_rating,
    r.title AS review_title,
    r.comment AS review_comment,
    r.created_at AS review_created_at
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  JOIN barber_profiles bp ON bp.id = a.barber_id
  LEFT JOIN availability_slots av ON av.id = a.availability_slot_id
  LEFT JOIN reviews r ON r.appointment_id = a.id
`;

export const getClientProfile = async (clientId: string) => {
  const rows = await query<Row>(
    `SELECT id,email,first_name,last_name,phone,email_verified,created_at
     FROM users WHERE id = $1 AND user_type = 'CLIENT'`,
    [clientId],
  );
  const user = rows[0];
  if (user === undefined) throw new AppError(404, 'Client not found.', 'CLIENT_NOT_FOUND');
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    emailVerified: user.email_verified,
    createdAt: dateTime(user.created_at),
  };
};

export const listSavedBarbers = async (clientId: string) => {
  const rows = await query<Row>(
    `SELECT
       csb.id,
       csb.created_at,
       bp.id AS barber_id,
       bp.business_name,
       bp.profile_photo_url,
       bp.city,
       bp.average_rating
     FROM client_saved_barbers csb
     JOIN barber_profiles bp ON bp.id = csb.barber_id
     JOIN users u ON u.id = bp.user_id
     WHERE csb.client_id = $1 AND u.is_active = true AND u.deleted_at IS NULL
     ORDER BY csb.created_at DESC`,
    [clientId],
  );

  return {
    savedBarbers: rows.map((row) => ({
      id: row.id,
      savedAt: dateTime(row.created_at),
      barber: {
        id: row.barber_id,
        businessName: row.business_name,
        profilePhotoUrl: row.profile_photo_url,
        city: row.city,
        averageRating: Number(row.average_rating),
      },
    })),
  };
};

export const saveBarber = async (clientId: string, barberId: string) => {
  await requireActiveBarber(barberId);
  try {
    const rows = await query<Row>(
      `INSERT INTO client_saved_barbers (client_id,barber_id)
       VALUES ($1,$2)
       RETURNING id, barber_id, created_at`,
      [clientId, barberId],
    );
    const row = rows[0] as Row;
    return {
      id: row.id,
      barberId: row.barber_id,
      savedAt: dateTime(row.created_at),
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      throw new AppError(409, 'Barber already saved.', 'ALREADY_SAVED');
    }
    throw error;
  }
};

export const removeSavedBarber = async (clientId: string, barberId: string) => {
  const rows = await query<Row>(
    'DELETE FROM client_saved_barbers WHERE client_id = $1 AND barber_id = $2 RETURNING id',
    [clientId, barberId],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'This barber is not in your saved list.', 'NOT_SAVED');
  }
  return { message: 'Barber removed from saved list.' };
};

export const bookAppointment = async (clientId: string, input: BookAppointmentRequest) =>
  withTransaction(async (trx) => {
    const barber = await requireActiveBarber(input.barberId, trx);
    const serviceRows = await query<Row>(
      `SELECT * FROM services
       WHERE id = $1 AND barber_id = $2 AND is_active = true`,
      [input.serviceId, input.barberId],
      trx,
    );
    const service = serviceRows[0];
    if (service === undefined) {
      throw new AppError(404, 'Service not found.', 'SERVICE_NOT_FOUND');
    }

    const slotRows = await query<Row>(
      `SELECT *,(slot_date::timestamp + start_time)::timestamp AS scheduled_at
       FROM availability_slots
       WHERE id = $1 AND barber_id = $2
       FOR UPDATE`,
      [input.availabilitySlotId, input.barberId],
      trx,
    );
    const slot = slotRows[0];
    if (slot === undefined || slot.status !== 'AVAILABLE') {
      throw new AppError(400, 'This time slot is no longer available.', 'SLOT_NOT_AVAILABLE');
    }
    if (new Date(String(slot.scheduled_at).replace(' ', 'T')).getTime() <= Date.now()) {
      throw new AppError(400, 'This time slot is no longer available.', 'SLOT_NOT_AVAILABLE');
    }
    if (Number(slot.duration_minutes) < Number(service.duration_minutes)) {
      throw new AppError(400, 'Selected slot is too short for this service.', 'SLOT_TOO_SHORT');
    }

    const conflictRows = await query<Row>(
      `SELECT id
       FROM appointments
       WHERE client_id = $1
         AND status IN ('PENDING','CONFIRMED')
         AND scheduled_at < ($2::timestamp + ($3::int * interval '1 minute'))
         AND (scheduled_at + (duration_minutes * interval '1 minute')) > $2::timestamp
       LIMIT 1`,
      [clientId, slot.scheduled_at, service.duration_minutes],
      trx,
    );
    if (conflictRows.length > 0) {
      throw new AppError(
        409,
        'You already have an appointment at this time.',
        'APPOINTMENT_CONFLICT',
      );
    }

    const appointmentRows = await query<Row>(
      `INSERT INTO appointments
        (client_id,barber_id,service_id,availability_slot_id,scheduled_at,duration_minutes,status,
         payment_status,price_quoted,location_address,location_latitude,location_longitude,client_notes)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING','PENDING',$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        clientId,
        input.barberId,
        input.serviceId,
        input.availabilitySlotId,
        slot.scheduled_at,
        service.duration_minutes,
        service.price,
        barber.address ??
          [barber.city, barber.state]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join(', '),
        barber.latitude,
        barber.longitude,
        input.clientNotes ?? null,
      ],
      trx,
    );
    const appointment = appointmentRows[0] as Row;

    await trx.query(
      `UPDATE availability_slots
       SET status = 'BOOKED', appointment_id = $1
       WHERE id = $2 AND status = 'AVAILABLE'`,
      [appointment.id, input.availabilitySlotId],
    );
    await trx.query(
      `INSERT INTO notifications (user_id,type,title,message,related_data)
       VALUES
         ($1,'APPOINTMENT_CONFIRMED','Appointment requested','Your appointment request was created.',$3::jsonb),
         ($2,'APPOINTMENT_CONFIRMED','New appointment request','A client booked one of your available slots.',$3::jsonb)`,
      [
        clientId,
        barber.user_id,
        JSON.stringify({ appointmentId: appointment.id, barberId: input.barberId }),
      ],
    );

    const rows = await query<Row>(
      `${appointmentSelect} WHERE a.id = $1 AND a.client_id = $2`,
      [appointment.id, clientId],
      trx,
    );
    return mapAppointment(rows[0] as Row);
  });

export const listClientAppointments = async (clientId: string, filters: ClientAppointmentQuery) => {
  const values: unknown[] = [clientId];
  const where = ['a.client_id = $1'];
  if (filters.status !== undefined) {
    values.push(filters.status);
    where.push(`a.status = $${values.length}`);
  }
  if (filters.upcoming === true) where.push('a.scheduled_at > CURRENT_TIMESTAMP');
  if (filters.past === true) where.push('a.scheduled_at <= CURRENT_TIMESTAMP');

  const whereSql = where.join(' AND ');
  const totalRows = await query<Row>(
    `SELECT COUNT(*)::int AS total FROM appointments a WHERE ${whereSql}`,
    values,
  );
  const total = Number(totalRows[0]?.total ?? 0);
  const rows = await query<Row>(
    `${appointmentSelect}
     WHERE ${whereSql}
     ORDER BY a.scheduled_at ${filters.past === true ? 'DESC' : 'ASC'}
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, filters.limit, (filters.page - 1) * filters.limit],
  );
  return {
    appointments: rows.map(mapAppointment),
    pagination: pagination(filters.page, filters.limit, total),
  };
};

export const getClientAppointment = async (clientId: string, appointmentId: string) => {
  const rows = await query<Row>(`${appointmentSelect} WHERE a.id = $1 AND a.client_id = $2`, [
    appointmentId,
    clientId,
  ]);
  const row = rows[0];
  if (row === undefined) throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
  return mapAppointment(row);
};

export const cancelClientAppointment = async (clientId: string, appointmentId: string) =>
  withTransaction(async (trx) => {
    const rows = await query<Row>(
      'SELECT * FROM appointments WHERE id = $1 AND client_id = $2 FOR UPDATE',
      [appointmentId, clientId],
      trx,
    );
    const appointment = rows[0];
    if (appointment === undefined) {
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    }
    if (!['PENDING', 'CONFIRMED'].includes(String(appointment.status))) {
      throw new AppError(400, 'Completed appointments cannot be cancelled.', 'CANNOT_CANCEL');
    }
    await trx.query(
      `UPDATE appointments
       SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [appointmentId],
    );
    let slotFreed = false;
    if (appointment.availability_slot_id !== null) {
      await trx.query(
        `UPDATE availability_slots
         SET status = 'AVAILABLE', appointment_id = NULL
         WHERE id = $1`,
        [appointment.availability_slot_id],
      );
      slotFreed = true;
    }
    const barberRows = await query<Row>(
      'SELECT user_id FROM barber_profiles WHERE id = $1',
      [appointment.barber_id],
      trx,
    );
    if (barberRows[0] !== undefined) {
      await trx.query(
        `INSERT INTO notifications (user_id,type,title,message,related_data)
         VALUES ($1,'APPOINTMENT_CANCELLED','Appointment cancelled','A client cancelled an appointment.',$2::jsonb)`,
        [barberRows[0].user_id, JSON.stringify({ appointmentId })],
      );
    }
    return { message: 'Appointment cancelled successfully.', appointmentId, slotFreed };
  });

export const createClientReview = async (clientId: string, input: CreateReviewRequest) =>
  withTransaction(async (trx) => {
    const rows = await query<Row>(
      'SELECT * FROM appointments WHERE id = $1 AND client_id = $2 FOR UPDATE',
      [input.appointmentId, clientId],
      trx,
    );
    const appointment = rows[0];
    if (appointment === undefined) {
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    }
    if (appointment.status !== 'COMPLETED') {
      throw new AppError(
        400,
        'You can only review completed appointments.',
        'APPOINTMENT_NOT_COMPLETED',
      );
    }
    const existing = await query<Row>(
      'SELECT id FROM reviews WHERE appointment_id = $1',
      [input.appointmentId],
      trx,
    );
    if (existing.length > 0) {
      throw new AppError(409, 'You have already reviewed this appointment.', 'REVIEW_EXISTS');
    }
    const reviewRows = await query<Row>(
      `INSERT INTO reviews (appointment_id,client_id,barber_id,rating,title,comment)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        input.appointmentId,
        clientId,
        appointment.barber_id,
        input.rating,
        input.title ?? null,
        input.comment ?? null,
      ],
      trx,
    );
    await trx.query(
      `UPDATE barber_profiles SET
        average_rating = (
          SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE barber_id = $1
        ),
        total_reviews = (
          SELECT COUNT(*) FROM reviews WHERE barber_id = $1
        ),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [appointment.barber_id],
    );
    const review = reviewRows[0] as Row;
    return {
      id: review.id,
      appointmentId: review.appointment_id,
      barberId: review.barber_id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: dateTime(review.created_at),
    };
  });
