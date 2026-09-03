/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type {
  AppointmentFilterSchema,
  CreateBarberProfileRequest,
  CreateServiceRequest,
  ScheduleEntry,
  UpdateBarberProfileRequest,
  UpdateServiceRequest,
} from '@barber-saas/shared-types';
import type { z } from 'zod';

import { SUBSCRIPTION_TIERS, type SubscriptionTierName } from '../../config/subscriptionTiers';
import { query, withTransaction, type DatabaseExecutor } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import { datesBetween, dayName, generateDaySlots, isoDayOfWeek } from '../../utils/slotGenerator';
import {
  calculateTravelBufferSlots,
  getReturnTravelBufferSlotTimes,
  getTravelBufferSlotTimes,
} from '../../utils/travelBuffer';
import { releaseTravelBufferSlots } from '../mobile/bufferSlotService';
import { stripePaymentsConfigured } from '../payment/stripeService';
import {
  createPublicCloudinaryUrl,
  deletePublicCloudinaryImage,
  isCloudinaryEnabled,
  storePublicCloudinaryImage,
} from '../storage/cloudinaryStorage';
import { createPresignedDownloadUrl } from '../storage/objectStorage';
import type { DownloadedImage } from '../storage/objectStorage';

type Row = Record<string, unknown>;
type AppointmentFilters = z.infer<typeof AppointmentFilterSchema>;

export const BARBER_ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'ON_THE_WAY', 'CANCELLED', 'NO_SHOW'],
  ON_THE_WAY: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
};

const profileNotFound = () =>
  new AppError(404, 'Barber profile does not exist. Create one first.', 'BARBER_PROFILE_NOT_FOUND');
const serviceNotFound = () => new AppError(404, 'Service not found.', 'SERVICE_NOT_FOUND');

const numberOrNull = (value: unknown): number | null => (value === null ? null : Number(value));
const time = (value: unknown): string => String(value).slice(0, 5);
const date = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const dateTime = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const mapProfile = (row: Row) => ({
  id: row.id,
  userId: row.user_id,
  businessName: row.business_name,
  headline: row.headline,
  businessType: row.business_type,
  bio: row.bio,
  yearsOfExperience: row.years_of_experience,
  languages: stringArray(row.languages),
  specialties: stringArray(row.specialties),
  averageRating: Number(row.average_rating),
  totalReviews: row.total_reviews,
  totalClients: row.total_clients,
  profilePhotoUrl: row.profile_photo_url,
  bannerUrl: row.banner_url,
  bannerAssetType: row.banner_asset_type,
  address: row.address,
  city: row.city,
  state: row.state,
  zipCode: row.zip_code,
  latitude: numberOrNull(row.latitude),
  longitude: numberOrNull(row.longitude),
  subscriptionTier: row.subscription_tier,
  isVerified: row.is_verified,
  portfolioCompletedAt:
    row.portfolio_completed_at === null ? null : dateTime(row.portfolio_completed_at),
  createdAt: dateTime(row.created_at),
  updatedAt: dateTime(row.updated_at),
});

const mapService = (row: Row) => ({
  id: row.id,
  barberId: row.barber_id,
  name: row.name,
  description: row.description,
  imageUrl: row.image_url,
  price: Number(row.price),
  durationMinutes: row.duration_minutes,
  category: row.category,
  isActive: row.is_active,
  createdAt: dateTime(row.created_at),
  updatedAt: dateTime(row.updated_at),
});

export const findBarberProfile = async (
  userId: string,
  executor?: DatabaseExecutor,
): Promise<Row | null> => {
  const rows = await query<Row>(
    'SELECT * FROM barber_profiles WHERE user_id = $1',
    [userId],
    executor,
  );
  return rows[0] ?? null;
};

const requireProfile = async (userId: string, executor?: DatabaseExecutor): Promise<Row> => {
  const profile = await findBarberProfile(userId, executor);
  if (profile === null) throw profileNotFound();
  return profile;
};

export const getMyProfile = async (userId: string) => mapProfile(await requireProfile(userId));

export const createProfile = async (userId: string, input: CreateBarberProfileRequest) => {
  if ((await findBarberProfile(userId)) !== null) {
    throw new AppError(
      409,
      'Barber profile already exists. Use PATCH to update.',
      'PROFILE_ALREADY_EXISTS',
    );
  }
  const fields = {
    business_name: input.businessName,
    headline: input.headline ?? null,
    business_type: input.businessType ?? 'INDEPENDENT',
    bio: input.bio ?? null,
    years_of_experience: input.yearsOfExperience ?? null,
    languages: JSON.stringify(input.languages ?? []),
    specialties: JSON.stringify(input.specialties ?? []),
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip_code: input.zipCode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };
  const rows = await query<Row>(
    `INSERT INTO barber_profiles
      (user_id, business_name, headline, business_type, bio, years_of_experience, languages,
       specialties, address, city, state, zip_code, latitude, longitude)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [userId, ...Object.values(fields)],
  );
  return mapProfile(rows[0] as Row);
};

export const updateProfile = async (userId: string, input: UpdateBarberProfileRequest) => {
  const profile = await requireProfile(userId);
  const columns: Record<string, unknown> = {
    businessName: ['business_name', input.businessName],
    headline: ['headline', input.headline],
    businessType: ['business_type', input.businessType],
    bio: ['bio', input.bio],
    yearsOfExperience: ['years_of_experience', input.yearsOfExperience],
    languages: [
      'languages',
      input.languages === undefined ? undefined : JSON.stringify(input.languages),
    ],
    specialties: [
      'specialties',
      input.specialties === undefined ? undefined : JSON.stringify(input.specialties),
    ],
    address: ['address', input.address],
    city: ['city', input.city],
    state: ['state', input.state],
    zipCode: ['zip_code', input.zipCode],
    latitude: ['latitude', input.latitude],
    longitude: ['longitude', input.longitude],
  };
  const entries = Object.entries(columns).filter(([key]) => Object.hasOwn(input, key)) as Array<
    [string, [string, unknown]]
  >;
  const values = entries.map(([, [, value]]) => value);
  const sets = entries.map(([, [column]], index) => `${column} = $${index + 1}`);
  values.push(profile.id);
  const rows = await query<Row>(
    `UPDATE barber_profiles SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return mapProfile(rows[0] as Row);
};

export const updatePhoto = async (userId: string, photoUrl: string) => {
  const profile = await requireProfile(userId);
  await query('UPDATE barber_profiles SET profile_photo_url = $1 WHERE id = $2', [
    photoUrl,
    profile.id,
  ]);
  return { profilePhotoUrl: photoUrl, message: 'Profile photo updated.' };
};

export const createOffering = async (userId: string, input: CreateServiceRequest) => {
  const profile = await requireProfile(userId);
  const count = await query<Row>(
    'SELECT COUNT(*)::int AS count FROM services WHERE barber_id = $1 AND is_active = true',
    [profile.id],
  );
  const tier = String(profile.subscription_tier);
  const serviceLimit =
    SUBSCRIPTION_TIERS[(tier as SubscriptionTierName) ?? 'FREE']?.maxServices ?? 5;
  if (Number(count[0]?.count) >= serviceLimit) {
    throw new AppError(
      403,
      `${tier} tier service limit reached. Upgrade to add more.`,
      'SERVICE_LIMIT_REACHED',
    );
  }
  const rows = await query<Row>(
    `INSERT INTO services (barber_id,name,description,price,duration_minutes,category)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      profile.id,
      input.name,
      input.description ?? null,
      input.price,
      input.durationMinutes,
      input.category,
    ],
  );
  return mapService(rows[0] as Row);
};

export const listOfferings = async (userId: string, active?: boolean, category?: string) => {
  const profile = await requireProfile(userId);
  const values: unknown[] = [profile.id];
  const where = ['barber_id = $1'];
  if (active !== undefined) {
    values.push(active);
    where.push(`is_active = $${values.length}`);
  }
  if (category !== undefined) {
    values.push(category);
    where.push(`category = $${values.length}`);
  }
  const rows = await query<Row>(
    `SELECT * FROM services WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    values,
  );
  return { services: rows.map(mapService), total: rows.length };
};

const requireOffering = async (userId: string, serviceId: string): Promise<Row> => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>('SELECT * FROM services WHERE id = $1 AND barber_id = $2', [
    serviceId,
    profile.id,
  ]);
  if (rows[0] === undefined) throw serviceNotFound();
  return rows[0];
};

export const getOffering = async (userId: string, serviceId: string) =>
  mapService(await requireOffering(userId, serviceId));

export const updateOffering = async (
  userId: string,
  serviceId: string,
  input: UpdateServiceRequest,
) => {
  await requireOffering(userId, serviceId);
  const mapping: Record<string, string> = {
    name: 'name',
    description: 'description',
    price: 'price',
    durationMinutes: 'duration_minutes',
    category: 'category',
    isActive: 'is_active',
  };
  const entries = Object.entries(input);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${mapping[key]} = $${index + 1}`);
  values.push(serviceId);
  const rows = await query<Row>(
    `UPDATE services SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return mapService(rows[0] as Row);
};

export const deactivateOffering = async (userId: string, serviceId: string) => {
  await requireOffering(userId, serviceId);
  await query('UPDATE services SET is_active = false WHERE id = $1', [serviceId]);
  return { message: 'Service deactivated successfully.', serviceId };
};

export const uploadOfferingImage = async (
  userId: string,
  serviceId: string,
  image: DownloadedImage,
) => {
  await requireOffering(userId, serviceId);
  if (!isCloudinaryEnabled()) {
    throw new AppError(
      503,
      'Service image uploads are temporarily unavailable.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }

  const uploaded = await storePublicCloudinaryImage(image, `services/${serviceId}`);
  const imageUrl = createPublicCloudinaryUrl(uploaded);
  const rows = await query<Row>(
    `UPDATE services
     SET image_url=$1,image_cloudinary_public_id=$2,image_cloudinary_version=$3,
         image_cloudinary_format=$4
     WHERE id=$5
     RETURNING *`,
    [imageUrl, uploaded.publicId, uploaded.version, uploaded.format, serviceId],
  );
  return mapService(rows[0] as Row);
};

export const removeOfferingImage = async (userId: string, serviceId: string) => {
  const service = await requireOffering(userId, serviceId);
  const publicId =
    typeof service.image_cloudinary_public_id === 'string'
      ? service.image_cloudinary_public_id
      : null;

  await query(
    `UPDATE services
     SET image_url=NULL,image_cloudinary_public_id=NULL,image_cloudinary_version=NULL,
         image_cloudinary_format=NULL
     WHERE id=$1`,
    [serviceId],
  );
  if (publicId !== null) {
    await deletePublicCloudinaryImage(publicId);
  }
  return mapService(await requireOffering(userId, serviceId));
};

const mapSchedule = (row: Row) => ({
  id: row.id,
  dayOfWeek: row.day_of_week,
  dayName: dayName(Number(row.day_of_week)),
  startTime: time(row.start_time),
  endTime: time(row.end_time),
  slotDurationMinutes: row.slot_duration_minutes,
  isActive: row.is_active,
});

export const getSchedule = async (userId: string) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    'SELECT * FROM barber_schedules WHERE barber_id = $1 ORDER BY day_of_week',
    [profile.id],
  );
  return { schedule: rows.map(mapSchedule) };
};

export const setSchedule = async (userId: string, schedule: ScheduleEntry[]) =>
  withTransaction(async (client) => {
    const profile = await requireProfile(userId, client);
    const days = schedule.map(({ dayOfWeek }) => dayOfWeek);
    await client.query(
      'DELETE FROM barber_schedules WHERE barber_id = $1 AND NOT (day_of_week = ANY($2::int[]))',
      [profile.id, days],
    );
    for (const entry of schedule) {
      await client.query(
        `INSERT INTO barber_schedules
          (barber_id,day_of_week,start_time,end_time,slot_duration_minutes,is_active)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (barber_id,day_of_week) DO UPDATE SET
          start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,
          slot_duration_minutes=EXCLUDED.slot_duration_minutes,is_active=EXCLUDED.is_active`,
        [
          profile.id,
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime,
          entry.slotDurationMinutes,
          entry.isActive,
        ],
      );
    }
    const rows = await query<Row>(
      'SELECT * FROM barber_schedules WHERE barber_id = $1 ORDER BY day_of_week',
      [profile.id],
      client,
    );
    return { message: 'Schedule updated successfully.', schedule: rows.map(mapSchedule) };
  });

const generateForProfile = async (
  profileId: unknown,
  startDate: string,
  endDate: string,
  executor?: DatabaseExecutor,
) => {
  const schedules = await query<Row>(
    'SELECT * FROM barber_schedules WHERE barber_id = $1 AND is_active = true',
    [profileId],
    executor,
  );
  const blocked = await query<Row>(
    'SELECT blocked_date FROM barber_blocked_dates WHERE barber_id = $1 AND blocked_date BETWEEN $2 AND $3',
    [profileId, startDate, endDate],
    executor,
  );
  const blockedDates = new Set(blocked.map((row) => date(row.blocked_date)));
  let generated = 0;
  let skipped = 0;
  for (const slotDate of datesBetween(startDate, endDate)) {
    const schedule = schedules.find((row) => Number(row.day_of_week) === isoDayOfWeek(slotDate));
    if (schedule === undefined || blockedDates.has(slotDate)) continue;
    for (const slot of generateDaySlots(
      time(schedule.start_time),
      time(schedule.end_time),
      Number(schedule.slot_duration_minutes),
    )) {
      const rows = await query<Row>(
        `INSERT INTO availability_slots
          (barber_id,slot_date,start_time,end_time,duration_minutes,status)
         VALUES ($1,$2,$3,$4,$5,'AVAILABLE')
         ON CONFLICT (barber_id,slot_date,start_time) DO NOTHING RETURNING id`,
        [profileId, slotDate, slot.startTime, slot.endTime, schedule.slot_duration_minutes],
        executor,
      );
      rows.length === 1 ? generated++ : skipped++;
    }
  }
  return { generated, skipped };
};

export const generateSlots = async (userId: string, startDate: string, endDate: string) => {
  const profile = await requireProfile(userId);
  const result = await generateForProfile(profile.id, startDate, endDate);
  return {
    message: 'Slots generated successfully.',
    ...result,
    dateRange: { start: startDate, end: endDate },
  };
};

/** Same wall-clock convention as getPublicSlots and the booking guard, so both sides agree. */
const slotIsPast = (row: Row, now: number): boolean =>
  new Date(`${date(row.slot_date)}T${time(row.start_time)}:00`).getTime() <= now;

const mapPrivateSlot = (row: Row, now: number) => ({
  id: row.id,
  date: date(row.slot_date),
  dayName: dayName(isoDayOfWeek(date(row.slot_date))),
  startTime: time(row.start_time),
  endTime: time(row.end_time),
  status: row.status,
  isPast: slotIsPast(row, now),
  appointmentSummary:
    row.appointment_id === null || row.appointment_id === undefined
      ? undefined
      : {
          appointmentId: row.appointment_id,
          customerName: `${String(row.client_first_name)} ${String(row.client_last_name)}`,
          serviceName: row.service_name,
          status: row.appointment_status,
        },
});

export const listSlots = async (userId: string, startDate: string, endDate: string) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    `SELECT sl.*,a.status AS appointment_status,s.name AS service_name,
            u.first_name AS client_first_name,u.last_name AS client_last_name
     FROM availability_slots sl
     LEFT JOIN appointments a ON a.id=sl.appointment_id AND a.barber_id=sl.barber_id
     LEFT JOIN services s ON s.id=a.service_id
     LEFT JOIN users u ON u.id=a.client_id
     WHERE sl.barber_id = $1 AND sl.slot_date BETWEEN $2 AND $3
     ORDER BY sl.slot_date,sl.start_time`,
    [profile.id, startDate, endDate],
  );
  const now = Date.now();
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  return {
    slots: rows.map((row) => mapPrivateSlot(row, now)),
    summary: {
      totalSlots: rows.length,
      // "Available" means still bookable. A free slot whose time has passed is not, so counting it
      // told the barber they had open capacity that no customer could actually take.
      available: rows.filter((row) => row.status === 'AVAILABLE' && !slotIsPast(row, now)).length,
      past: rows.filter((row) => slotIsPast(row, now)).length,
      booked: count('BOOKED'),
      blocked: count('BLOCKED'),
    },
  };
};

export const getPaymentPreferences = async (userId: string) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    `SELECT online_payments_enabled,stripe_onboarding_complete,
            stripe_charges_enabled,stripe_payouts_enabled
     FROM barber_profiles WHERE id=$1`,
    [profile.id],
  );
  const row = rows[0] as Row;
  return {
    onlinePaymentsEnabled: row.online_payments_enabled === true,
    onlinePaymentsReady:
      row.online_payments_enabled === true &&
      row.stripe_onboarding_complete === true &&
      row.stripe_charges_enabled === true &&
      row.stripe_payouts_enabled === true &&
      stripePaymentsConfigured(),
  };
};

export const updatePaymentPreferences = async (userId: string, enabled: boolean) => {
  const profile = await requireProfile(userId);
  await query('UPDATE barber_profiles SET online_payments_enabled=$2 WHERE id=$1', [
    profile.id,
    enabled,
  ]);
  return getPaymentPreferences(userId);
};

export const blockDate = async (userId: string, blockedDate: string, reason?: string) =>
  withTransaction(async (client) => {
    const profile = await requireProfile(userId, client);
    const result = await query<Row>(
      `INSERT INTO barber_blocked_dates (barber_id,blocked_date,reason)
       VALUES ($1,$2,$3)
       ON CONFLICT (barber_id,blocked_date) DO UPDATE SET reason=EXCLUDED.reason RETURNING *`,
      [profile.id, blockedDate, reason ?? null],
      client,
    );
    await client.query(
      `UPDATE availability_slots SET status='BLOCKED'
       WHERE barber_id=$1 AND slot_date=$2 AND status='AVAILABLE'`,
      [profile.id, blockedDate],
    );
    return {
      id: result[0]?.id,
      date: blockedDate,
      reason: result[0]?.reason,
      message: 'Date blocked. Existing available slots for this date were blocked.',
    };
  });

export const listBlockedDates = async (userId: string) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    `SELECT id, blocked_date, reason
     FROM barber_blocked_dates
     WHERE barber_id = $1 AND blocked_date >= CURRENT_DATE
     ORDER BY blocked_date`,
    [profile.id],
  );

  return {
    blockedDates: rows.map((row) => ({
      id: row.id,
      date: date(row.blocked_date),
      reason: row.reason,
    })),
  };
};

export const unblockDate = async (userId: string, blockedDate: string) =>
  withTransaction(async (client) => {
    const profile = await requireProfile(userId, client);
    const deleted = await query<Row>(
      'DELETE FROM barber_blocked_dates WHERE barber_id=$1 AND blocked_date=$2 RETURNING id',
      [profile.id, blockedDate],
      client,
    );
    if (deleted.length === 0)
      throw new AppError(404, 'Blocked date not found.', 'BLOCKED_DATE_NOT_FOUND');
    await client.query(
      `UPDATE availability_slots SET status='AVAILABLE'
       WHERE barber_id=$1 AND slot_date=$2 AND status='BLOCKED'`,
      [profile.id, blockedDate],
    );
    await generateForProfile(profile.id, blockedDate, blockedDate, client);
    return { message: 'Date unblocked.', date: blockedDate };
  });

export const listAppointments = async (userId: string, filters: AppointmentFilters) => {
  const profile = await requireProfile(userId);
  const values: unknown[] = [profile.id];
  const where = ['a.barber_id=$1'];
  if (filters.status !== undefined) {
    values.push(filters.status);
    where.push(`a.status=$${values.length}`);
  }
  if (filters.date !== undefined) {
    values.push(filters.date);
    where.push(`a.scheduled_at::date=$${values.length}`);
  } else if (filters.startDate !== undefined && filters.endDate !== undefined) {
    values.push(filters.startDate, filters.endDate);
    where.push(`a.scheduled_at::date BETWEEN $${values.length - 1} AND $${values.length}`);
  }
  const countRows = await query<Row>(
    `SELECT COUNT(*)::int AS total FROM appointments a WHERE ${where.join(' AND ')}`,
    values,
  );
  values.push(filters.limit, (filters.page - 1) * filters.limit);
  const rows = await query<Row>(
    `SELECT a.*,s.name AS service_name,u.first_name,u.last_name,u.phone,u.email,
      hd.id AS style_design_id,hd.style_name,hd.description AS style_description,
      hd.generated_preview_url,hd.generated_asset_key,hd.source_photo_url,hd.source_asset_key
     FROM appointments a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.client_id
     LEFT JOIN client_hair_designs hd
       ON hd.id=a.style_reference_id
      AND hd.client_id=a.client_id
      AND hd.deleted_at IS NULL
     WHERE ${where.join(' AND ')} ORDER BY a.scheduled_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const total = Number(countRows[0]?.total ?? 0);
  return {
    appointments: await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        barberId: row.barber_id,
        clientId: row.client_id,
        serviceId: row.service_id,
        scheduledAt: dateTime(row.scheduled_at),
        scheduledDate: dateTime(row.scheduled_at).slice(0, 10),
        startTime: dateTime(row.scheduled_at).slice(11, 16),
        durationMinutes: row.duration_minutes,
        status: row.status,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method ?? 'CASH',
        priceQuoted: Number(row.price_quoted),
        price: Number(row.price_quoted),
        service: { id: row.service_id, name: row.service_name },
        serviceName: row.service_name,
        client: {
          id: row.client_id,
          firstName: row.first_name,
          lastName: row.last_name,
          phone: row.phone,
        },
        clientName: `${String(row.first_name)} ${String(row.last_name)}`,
        clientPhone: row.phone,
        clientNotes: row.client_notes,
        barberNotes: row.barber_notes,
        styleNotes: row.style_notes,
        isMobileService: row.is_mobile_service === true,
        serviceAddress:
          row.is_mobile_service === true
            ? {
                addressLine1: row.service_address_line1,
                city: row.service_address_city,
                state: row.service_address_state,
                zipCode: row.service_address_zip,
                latitude: numberOrNull(row.service_latitude),
                longitude: numberOrNull(row.service_longitude),
                formattedAddress: row.service_address_formatted,
                source: row.service_address_source,
                isApproximateAddress: row.service_address_is_approximate,
              }
            : null,
        distanceMiles: numberOrNull(row.distance_miles),
        estimatedTravelMinutes: row.estimated_travel_minutes,
        travelFeeCents: Number(row.travel_fee_cents ?? 0),
        travelFee: Number(row.travel_fee_cents ?? 0) / 100,
        barberDepartedAt: row.barber_departed_at === null ? null : dateTime(row.barber_departed_at),
        barberArrivedAt: row.barber_arrived_at === null ? null : dateTime(row.barber_arrived_at),
        styleReference:
          row.style_design_id === null || row.style_design_id === undefined
            ? null
            : {
                id: row.style_design_id,
                styleName: row.style_name,
                description: row.style_description,
                previewImageUrl:
                  typeof row.generated_asset_key === 'string'
                    ? await createPresignedDownloadUrl(row.generated_asset_key)
                    : row.generated_preview_url,
                sourcePhotoUrl:
                  typeof row.source_asset_key === 'string'
                    ? await createPresignedDownloadUrl(row.source_asset_key)
                    : row.source_photo_url,
              },
      })),
    ),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const getAppointment = async (userId: string, appointmentId: string) => {
  const rows = await query<Row>(
    `SELECT a.*,s.name AS service_name,u.first_name,u.last_name,u.phone,u.email,
      bp.address AS shop_address,bp.city AS shop_city,bp.state AS shop_state,
      bp.zip_code AS shop_zip,bp.latitude AS shop_latitude,bp.longitude AS shop_longitude,
      mbc.origin_latitude AS mobile_origin_latitude,
      mbc.origin_longitude AS mobile_origin_longitude,
      hd.id AS style_design_id,hd.style_name,hd.description AS style_description,
      hd.generated_preview_url,hd.generated_asset_key,hd.source_photo_url,hd.source_asset_key
     FROM appointments a
     JOIN services s ON s.id=a.service_id
     JOIN users u ON u.id=a.client_id
     JOIN barber_profiles bp ON bp.id=a.barber_id AND bp.user_id=$2
     LEFT JOIN mobile_barber_config mbc ON mbc.barber_id=bp.id
     LEFT JOIN client_hair_designs hd
       ON hd.id=a.style_reference_id
      AND hd.client_id=a.client_id
      AND hd.deleted_at IS NULL
     WHERE a.id=$1`,
    [appointmentId, userId],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
  }
  const serviceFee = Number(row.price_quoted);
  const travelFee = Number(row.travel_fee_cents ?? 0) / 100;
  const isMobileService = row.is_mobile_service === true;
  const mobileLocation = isMobileService
    ? {
        kind: 'MOBILE' as const,
        addressLine1: row.service_address_line1 === null ? null : String(row.service_address_line1),
        city: row.service_address_city === null ? null : String(row.service_address_city),
        state: row.service_address_state === null ? null : String(row.service_address_state),
        zipCode: row.service_address_zip === null ? null : String(row.service_address_zip),
        formattedAddress:
          row.service_address_formatted === null ? null : String(row.service_address_formatted),
        latitude: numberOrNull(row.service_latitude),
        longitude: numberOrNull(row.service_longitude),
        isApproximateAddress: row.service_address_is_approximate === true,
      }
    : null;
  const shopLocation =
    !isMobileService &&
    (row.shop_address !== null || (row.shop_latitude !== null && row.shop_longitude !== null))
      ? {
          kind: 'SHOP' as const,
          addressLine1: row.shop_address === null ? null : String(row.shop_address),
          city: row.shop_city === null ? null : String(row.shop_city),
          state: row.shop_state === null ? null : String(row.shop_state),
          zipCode: row.shop_zip === null ? null : String(row.shop_zip),
          formattedAddress: row.shop_address === null ? null : String(row.shop_address),
          latitude: numberOrNull(row.shop_latitude),
          longitude: numberOrNull(row.shop_longitude),
          isApproximateAddress: false,
        }
      : null;
  const styleReference =
    row.style_design_id === null || row.style_design_id === undefined
      ? null
      : {
          id: String(row.style_design_id),
          styleName: row.style_name === null ? null : String(row.style_name),
          description: row.style_description === null ? null : String(row.style_description),
          previewImageUrl:
            typeof row.generated_asset_key === 'string'
              ? await createPresignedDownloadUrl(row.generated_asset_key)
              : row.generated_preview_url === null
                ? null
                : String(row.generated_preview_url),
          sourcePhotoUrl:
            typeof row.source_asset_key === 'string'
              ? await createPresignedDownloadUrl(row.source_asset_key)
              : row.source_photo_url === null
                ? null
                : String(row.source_photo_url),
        };
  const scheduledAt = dateTime(row.scheduled_at);
  const routeOriginLatitude =
    numberOrNull(row.mobile_origin_latitude) ?? numberOrNull(row.shop_latitude);
  const routeOriginLongitude =
    numberOrNull(row.mobile_origin_longitude) ?? numberOrNull(row.shop_longitude);
  const routeOrigin =
    routeOriginLatitude !== null && routeOriginLongitude !== null
      ? { latitude: routeOriginLatitude, longitude: routeOriginLongitude }
      : null;
  return {
    id: row.id,
    barberId: row.barber_id,
    clientId: row.client_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    clientName: `${String(row.first_name)} ${String(row.last_name)}`,
    clientPhone: row.phone,
    scheduledAt,
    scheduledDate: scheduledAt.slice(0, 10),
    startTime: scheduledAt.slice(11, 16),
    durationMinutes: Number(row.duration_minutes),
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method ?? 'CASH',
    priceQuoted: serviceFee,
    price: serviceFee,
    service: { id: row.service_id, name: row.service_name },
    client: {
      id: row.client_id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: String(row.email),
    },
    isMobileService,
    serviceAddress: mobileLocation,
    pricing: { serviceFee, travelFee, total: serviceFee + travelFee, currency: 'USD' as const },
    location: mobileLocation ?? shopLocation,
    distanceMiles: numberOrNull(row.distance_miles),
    estimatedTravelMinutes:
      row.estimated_travel_minutes === null ? null : Number(row.estimated_travel_minutes),
    travelFee,
    travelFeeCents: Number(row.travel_fee_cents ?? 0),
    clientNotes: row.client_notes,
    barberNotes: row.barber_notes,
    styleNotes: row.style_notes,
    styleReference,
    barberDepartedAt: row.barber_departed_at === null ? null : dateTime(row.barber_departed_at),
    barberArrivedAt: row.barber_arrived_at === null ? null : dateTime(row.barber_arrived_at),
    journey: {
      departedAt: row.barber_departed_at === null ? null : dateTime(row.barber_departed_at),
      arrivedAt: row.barber_arrived_at === null ? null : dateTime(row.barber_arrived_at),
      isTracking: row.status === 'ON_THE_WAY',
      routeOrigin,
    },
    timeline: (isMobileService
      ? [
          ['PENDING', 'Requested', row.created_at],
          ['CONFIRMED', 'Confirmed', row.confirmed_at],
          ['ON_THE_WAY', 'On the way', row.barber_departed_at],
          ['ARRIVED', 'Arrived', row.barber_arrived_at],
          ['IN_PROGRESS', 'Service in progress', null],
          ['COMPLETED', 'Completed', row.completed_at],
        ]
      : [
          ['PENDING', 'Requested', row.created_at],
          ['CONFIRMED', 'Confirmed', row.confirmed_at],
          ['IN_PROGRESS', 'Service in progress', null],
          ['COMPLETED', 'Completed', row.completed_at],
        ]
    ).map(([status, label, at], index, entries) => {
      const currentIndex = entries.findIndex(([entryStatus]) => entryStatus === row.status);
      const terminal = row.status === 'CANCELLED' || row.status === 'NO_SHOW';
      return {
        status,
        label,
        at: at === null || at === undefined ? null : dateTime(at),
        done: !terminal && currentIndex >= 0 && index < currentIndex,
        current: status === row.status,
      };
    }),
  };
};

export const updateAppointmentStatus = async (
  userId: string,
  appointmentId: string,
  nextStatus: string,
  notes?: string,
) =>
  withTransaction(async (client) => {
    const profile = await requireProfile(userId, client);
    const rows = await query<Row>(
      'SELECT * FROM appointments WHERE id=$1 AND barber_id=$2 FOR UPDATE',
      [appointmentId, profile.id],
      client,
    );
    const appointment = rows[0];
    if (appointment === undefined)
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    const current = String(appointment.status);
    if (['ON_THE_WAY', 'ARRIVED'].includes(nextStatus) && appointment.is_mobile_service !== true) {
      throw new AppError(
        400,
        'This status is only available for mobile appointments.',
        'INVALID_STATUS_FOR_APPOINTMENT_TYPE',
      );
    }
    if (
      appointment.is_mobile_service === true &&
      current === 'CONFIRMED' &&
      nextStatus === 'IN_PROGRESS'
    ) {
      throw new AppError(
        400,
        'Start the journey and mark arrival before beginning a mobile service.',
        'INVALID_STATUS_TRANSITION',
      );
    }
    if (!(BARBER_ALLOWED_TRANSITIONS[current] ?? []).includes(nextStatus)) {
      throw new AppError(
        400,
        `Cannot transition from ${current} to ${nextStatus}.`,
        'INVALID_STATUS_TRANSITION',
      );
    }
    const timestampColumn =
      nextStatus === 'CONFIRMED'
        ? 'confirmed_at'
        : nextStatus === 'COMPLETED'
          ? 'completed_at'
          : nextStatus === 'CANCELLED'
            ? 'cancelled_at'
            : nextStatus === 'ON_THE_WAY'
              ? 'barber_departed_at'
              : nextStatus === 'ARRIVED'
                ? 'barber_arrived_at'
                : null;
    const values: unknown[] = [nextStatus, notes ?? appointment.barber_notes, appointmentId];
    const timestampSet = timestampColumn === null ? '' : `, ${timestampColumn}=CURRENT_TIMESTAMP`;
    const updated = await query<Row>(
      `UPDATE appointments SET status=$1,barber_notes=$2${timestampSet} WHERE id=$3 RETURNING *`,
      values,
      client,
    );
    if (nextStatus === 'CANCELLED' && appointment.availability_slot_id !== null) {
      await client.query(
        `UPDATE availability_slots SET status='AVAILABLE',appointment_id=NULL WHERE id=$1`,
        [appointment.availability_slot_id],
      );
    }
    if (nextStatus === 'CANCELLED') await releaseTravelBufferSlots(appointmentId, client);
    if (nextStatus === 'CONFIRMED' || nextStatus === 'ON_THE_WAY' || nextStatus === 'ARRIVED') {
      const message =
        nextStatus === 'CONFIRMED'
          ? 'Your appointment is confirmed!'
          : nextStatus === 'ON_THE_WAY'
            ? 'Your barber is on the way!'
            : 'Your barber has arrived!';
      const notificationType =
        nextStatus === 'CONFIRMED'
          ? 'APPOINTMENT_CONFIRMED'
          : nextStatus === 'ON_THE_WAY'
            ? 'JOURNEY_STARTED'
            : 'BARBER_ARRIVED';
      await client.query(
        `INSERT INTO notifications (user_id,type,title,message,related_data)
         VALUES ($1,$2::notification_type_enum,$3::text,$3::text,$4::jsonb)`,
        [appointment.client_id, notificationType, message, JSON.stringify({ appointmentId })],
      );
    }
    return {
      id: updated[0]?.id,
      status: updated[0]?.status,
      updatedAt: dateTime(updated[0]?.updated_at),
    };
  });

export const getPublicProfile = async (barberId: string) => {
  const rows = await query<Row>(
    `SELECT bp.*,mc.is_enabled AS mobile_enabled,mc.service_radius_miles,mc.fee_structure,
      mc.base_fee_cents,mc.per_mile_rate_cents,mc.mobile_service_notes
     FROM barber_profiles bp
     LEFT JOIN mobile_barber_config mc ON mc.barber_id=bp.id AND mc.is_enabled=true
     WHERE bp.id=$1`,
    [barberId],
  );
  const row = rows[0];
  if (row === undefined) throw profileNotFound();
  const shopLatitude = row.latitude === null ? null : Number(row.latitude);
  const shopLongitude = row.longitude === null ? null : Number(row.longitude);
  const hasShopLocation =
    typeof row.address === 'string' &&
    row.address.length > 0 &&
    shopLatitude !== null &&
    shopLongitude !== null &&
    Number.isFinite(shopLatitude) &&
    Number.isFinite(shopLongitude);
  return {
    id: row.id,
    businessName: row.business_name,
    headline: row.headline,
    businessType: row.business_type,
    bio: row.bio,
    yearsOfExperience: row.years_of_experience,
    languages: stringArray(row.languages),
    specialties: stringArray(row.specialties),
    averageRating: Number(row.average_rating),
    totalReviews: row.total_reviews,
    totalClients: row.total_clients,
    profilePhotoUrl: row.profile_photo_url,
    bannerUrl: row.banner_url,
    bannerAssetType: row.banner_asset_type,
    city: row.city,
    state: row.state,
    subscriptionTier: row.subscription_tier,
    isVerified: row.is_verified,
    onlinePaymentsAvailable:
      row.online_payments_enabled === true &&
      row.stripe_onboarding_complete === true &&
      row.stripe_charges_enabled === true &&
      row.stripe_payouts_enabled === true &&
      stripePaymentsConfigured(),
    shopLocation: hasShopLocation
      ? {
          address: row.address,
          city: row.city,
          state: row.state,
          zipCode: row.zip_code,
          latitude: shopLatitude,
          longitude: shopLongitude,
        }
      : null,
    mobileService:
      row.mobile_enabled === true
        ? {
            isEnabled: true,
            serviceRadiusMiles: Number(row.service_radius_miles),
            travelFeeStructure: row.fee_structure,
            baseFee: Number(row.base_fee_cents) / 100,
            perMileRate:
              row.fee_structure === 'per_mile' ? Number(row.per_mile_rate_cents) / 100 : null,
            notes: row.mobile_service_notes,
          }
        : null,
  };
};

export const getPublicOfferings = async (barberId: string) => {
  await getPublicProfile(barberId);
  const rows = await query<Row>(
    'SELECT * FROM services WHERE barber_id=$1 AND is_active=true ORDER BY name',
    [barberId],
  );
  return {
    services: rows.map((row) => {
      const service = mapService(row);
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        imageUrl: service.imageUrl,
        price: service.price,
        durationMinutes: service.durationMinutes,
        category: service.category,
      };
    }),
  };
};

export const getPublicSlots = async (
  barberId: string,
  startDate: string,
  endDate: string,
  travelMinutes?: number,
) => {
  await getPublicProfile(barberId);
  const rows = await query<Row>(
    `SELECT * FROM availability_slots
     WHERE barber_id=$1 AND slot_date BETWEEN $2 AND $3
       AND status IN ('AVAILABLE','BOOKED') AND is_travel_buffer=false
     ORDER BY slot_date,start_time`,
    [barberId, startDate, endDate],
  );
  const inventory =
    travelMinutes === undefined
      ? []
      : await query<Row>(
          `SELECT * FROM availability_slots
           WHERE barber_id=$1 AND slot_date BETWEEN ($2::date - INTERVAL '1 day') AND ($3::date + INTERVAL '1 day')
           ORDER BY slot_date,start_time`,
          [barberId, startDate, endDate],
        );
  const inventoryByTime = new Map(
    inventory.map((slotRow) => [`${date(slotRow.slot_date)}:${time(slotRow.start_time)}`, slotRow]),
  );
  const now = Date.now();
  return {
    slots: rows.map((row) => {
      const slotDate = date(row.slot_date);
      const slotStart = time(row.start_time);
      // Mirrors the guard in clientService.createAppointment exactly — same naive local wall time,
      // parsed in the API process's zone — so the list can never offer a slot that booking would
      // then reject with SLOT_NOT_AVAILABLE.
      const isPast = new Date(`${slotDate}T${slotStart}:00`).getTime() <= now;
      const isBooked = row.status === 'BOOKED';
      const isAvailable = row.status === 'AVAILABLE' && !isPast;
      const durationMinutes = Number(row.duration_minutes);
      const required =
        travelMinutes === undefined
          ? []
          : [
              ...getTravelBufferSlotTimes(
                date(row.slot_date),
                time(row.start_time),
                calculateTravelBufferSlots(travelMinutes, durationMinutes),
                durationMinutes,
              ),
              ...getReturnTravelBufferSlotTimes(
                date(row.slot_date),
                time(row.end_time),
                calculateTravelBufferSlots(travelMinutes, durationMinutes),
                durationMinutes,
              ),
            ];
      const availableForMobile =
        travelMinutes === undefined
          ? undefined
          : isAvailable &&
            required.every((requiredSlot) => {
              const candidate = inventoryByTime.get(
                `${requiredSlot.date}:${requiredSlot.startTime}`,
              );
              return candidate?.status === 'AVAILABLE' && candidate.is_travel_buffer !== true;
            });
      return {
        id: row.id,
        date: slotDate,
        startTime: slotStart,
        endTime: time(row.end_time),
        isAvailable,
        isPast,
        // Booked slots are still returned so the customer can see the day is genuinely filling up
        // rather than silently missing times; the UI shows them struck through and unclickable.
        status: isPast
          ? ('PAST' as const)
          : isBooked
            ? ('BOOKED' as const)
            : ('AVAILABLE' as const),
        ...(availableForMobile === undefined ? {} : { availableForMobile }),
      };
    }),
  };
};
