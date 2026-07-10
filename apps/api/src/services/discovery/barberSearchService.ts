/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type { BarberSearchQuery, ReviewQuery } from '@barber-saas/shared-types';

import { query } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';

type Row = Record<string, unknown>;

const dateTime = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value).replace(' ', 'T')).toISOString();
};

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const searchBarbers = async (filters: BarberSearchQuery) => {
  const values: unknown[] = [];
  const where = ['u.is_active = true', 'u.deleted_at IS NULL', "u.user_type = 'BARBER'"];

  if (filters.q !== undefined && filters.q.length > 0) {
    values.push(`%${filters.q}%`);
    where.push(`(bp.business_name ILIKE $${values.length} OR bp.bio ILIKE $${values.length})`);
  }
  if (filters.city !== undefined && filters.city.length > 0) {
    values.push(filters.city);
    where.push(`LOWER(bp.city) = LOWER($${values.length})`);
  }
  if (filters.state !== undefined && filters.state.length > 0) {
    values.push(filters.state);
    where.push(`LOWER(bp.state) = LOWER($${values.length})`);
  }
  if (filters.minRating !== undefined) {
    values.push(filters.minRating);
    where.push(`bp.average_rating >= $${values.length}`);
  }
  if (filters.verified !== undefined) {
    values.push(filters.verified);
    where.push(`bp.is_verified = $${values.length}`);
  }
  if (filters.category !== undefined) {
    values.push(filters.category);
    where.push(`EXISTS (
      SELECT 1 FROM services s
      WHERE s.barber_id = bp.id AND s.is_active = true AND s.category = $${values.length}
    )`);
  }
  if (filters.maxPrice !== undefined) {
    values.push(filters.maxPrice);
    where.push(`EXISTS (
      SELECT 1 FROM services s
      WHERE s.barber_id = bp.id AND s.is_active = true AND s.price <= $${values.length}
    )`);
  }

  const whereSql = where.join(' AND ');
  const totalRows = await query<Row>(
    `SELECT COUNT(*)::int AS total
     FROM barber_profiles bp
     JOIN users u ON u.id = bp.user_id
     WHERE ${whereSql}`,
    values,
  );
  const total = Number(totalRows[0]?.total ?? 0);
  const pagingValues = [...values, filters.limit, (filters.page - 1) * filters.limit];
  const rows = await query<Row>(
    `SELECT
       bp.id,
       bp.business_name,
       bp.bio,
       bp.profile_photo_url,
       bp.city,
       bp.state,
       bp.average_rating,
       bp.total_reviews,
       bp.is_verified,
       bp.subscription_tier,
       service_summary.lowest_service_price,
       COALESCE(service_summary.service_categories, ARRAY[]::text[]) AS service_categories,
       next_slot.next_available_slot
     FROM barber_profiles bp
     JOIN users u ON u.id = bp.user_id
     LEFT JOIN LATERAL (
       SELECT
         MIN(s.price)::numeric AS lowest_service_price,
         ARRAY_AGG(DISTINCT s.category ORDER BY s.category) AS service_categories
       FROM services s
       WHERE s.barber_id = bp.id AND s.is_active = true
     ) service_summary ON true
     LEFT JOIN LATERAL (
       SELECT (a.slot_date::timestamp + a.start_time)::timestamp AS next_available_slot
       FROM availability_slots a
       WHERE a.barber_id = bp.id
         AND a.status = 'AVAILABLE'
         AND (a.slot_date::timestamp + a.start_time) > CURRENT_TIMESTAMP
       ORDER BY a.slot_date, a.start_time
       LIMIT 1
     ) next_slot ON true
     WHERE ${whereSql}
     ORDER BY bp.average_rating DESC, bp.total_reviews DESC, bp.created_at DESC
     LIMIT $${pagingValues.length - 1} OFFSET $${pagingValues.length}`,
    pagingValues,
  );

  return {
    barbers: rows.map((row) => ({
      id: row.id,
      businessName: row.business_name,
      bio: row.bio,
      profilePhotoUrl: row.profile_photo_url,
      city: row.city,
      state: row.state,
      averageRating: Number(row.average_rating),
      totalReviews: row.total_reviews,
      isVerified: row.is_verified,
      subscriptionTier: row.subscription_tier,
      lowestServicePrice:
        row.lowest_service_price === null ? null : Number(row.lowest_service_price),
      serviceCategories: row.service_categories,
      nextAvailableSlot: dateTime(row.next_available_slot),
    })),
    pagination: pagination(filters.page, filters.limit, total),
  };
};

export const listPublicReviews = async (barberId: string, filters: ReviewQuery) => {
  const barberRows = await query<Row>(
    'SELECT average_rating,total_reviews FROM barber_profiles WHERE id = $1',
    [barberId],
  );
  const barber = barberRows[0];
  if (barber === undefined) {
    throw new AppError(404, 'Barber profile does not exist.', 'BARBER_PROFILE_NOT_FOUND');
  }

  const orderBy =
    filters.sort === 'highest'
      ? 'r.rating DESC, r.created_at DESC'
      : filters.sort === 'lowest'
        ? 'r.rating ASC, r.created_at DESC'
        : 'r.created_at DESC';

  const totalRows = await query<Row>(
    'SELECT COUNT(*)::int AS total FROM reviews WHERE barber_id = $1',
    [barberId],
  );
  const distributionRows = await query<Row>(
    `SELECT rating, COUNT(*)::int AS count
     FROM reviews
     WHERE barber_id = $1
     GROUP BY rating`,
    [barberId],
  );
  const rows = await query<Row>(
    `SELECT r.*, u.first_name, u.last_name
     FROM reviews r
     JOIN users u ON u.id = r.client_id
     WHERE r.barber_id = $1
     ORDER BY ${orderBy}
     LIMIT $2 OFFSET $3`,
    [barberId, filters.limit, (filters.page - 1) * filters.limit],
  );

  const distribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
  for (const row of distributionRows) {
    distribution[String(row.rating)] = Number(row.count);
  }
  const total = Number(totalRows[0]?.total ?? 0);

  return {
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      createdAt: dateTime(row.created_at),
      client: {
        firstName: row.first_name,
        lastInitial: String(row.last_name ?? '').slice(0, 1),
      },
    })),
    summary: {
      averageRating: Number(barber.average_rating),
      totalReviews: Number(barber.total_reviews),
      distribution,
    },
    pagination: pagination(filters.page, filters.limit, total),
  };
};
