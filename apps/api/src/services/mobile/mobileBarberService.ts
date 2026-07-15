/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type { SetMobileConfigRequest, TravelEstimateRequest } from '@barber-saas/shared-types';

import { query, type DatabaseExecutor } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';

import { getTravelMetrics } from './travelEstimateService';

type Row = Record<string, unknown>;

export const suggestTravelFee = (radiusMiles: number) => {
  if (radiusMiles <= 5)
    return { flat: 1000, perMile: 200, rationale: 'Short-range urban rate. $10 flat or $2/mile.' };
  if (radiusMiles <= 15)
    return { flat: 1500, perMile: 175, rationale: 'Mid-range urban rate. $15 flat or $1.75/mile.' };
  if (radiusMiles <= 30)
    return { flat: 2000, perMile: 150, rationale: 'Extended range rate. $20 flat or $1.50/mile.' };
  return { flat: 3000, perMile: 125, rationale: 'Long-range rate. $30 flat or $1.25/mile.' };
};

const profileForUser = async (userId: string, executor?: DatabaseExecutor): Promise<Row> => {
  const rows = await query<Row>(
    'SELECT * FROM barber_profiles WHERE user_id = $1',
    [userId],
    executor,
  );
  if (rows[0] === undefined)
    throw new AppError(404, 'Barber profile does not exist.', 'BARBER_PROFILE_NOT_FOUND');
  return rows[0];
};

export const mapMobileConfig = (row: Row | undefined) => {
  const radius = Number(row?.service_radius_miles ?? 10);
  return {
    isEnabled: row?.is_enabled === true,
    ...(row === undefined
      ? {}
      : {
          id: row.id,
          barberId: row.barber_id,
          serviceRadiusMiles: radius,
          feeStructure: row.fee_structure,
          baseFeeCents: Number(row.base_fee_cents),
          perMileRateCents: Number(row.per_mile_rate_cents),
          originLatitude: Number(row.origin_latitude),
          originLongitude: Number(row.origin_longitude),
          originAddress: row.origin_address,
          mobileServiceNotes: row.mobile_service_notes,
        }),
    suggestedFee: suggestTravelFee(radius),
  };
};

export const getMobileConfig = async (userId: string) => {
  const profile = await profileForUser(userId);
  const rows = await query<Row>('SELECT * FROM mobile_barber_config WHERE barber_id = $1', [
    profile.id,
  ]);
  return mapMobileConfig(rows[0]);
};

export const getPublicMobileConfig = async (barberId: string) => {
  const profiles = await query<Row>('SELECT city,state FROM barber_profiles WHERE id = $1', [
    barberId,
  ]);
  if (profiles[0] === undefined) {
    throw new AppError(404, 'Barber profile does not exist.', 'BARBER_PROFILE_NOT_FOUND');
  }
  const rows = await query<Row>(
    'SELECT * FROM mobile_barber_config WHERE barber_id = $1 AND is_enabled = true',
    [barberId],
  );
  const config = rows[0];
  if (config === undefined) return { isEnabled: false };
  const profile = profiles[0];
  return {
    isEnabled: true,
    serviceRadiusMiles: Number(config.service_radius_miles),
    feeStructure: config.fee_structure,
    baseFee: Number(config.base_fee_cents) / 100,
    perMileRate:
      config.fee_structure === 'per_mile' ? Number(config.per_mile_rate_cents) / 100 : null,
    mobileServiceNotes: config.mobile_service_notes,
    originCity: [profile.city, profile.state].filter(Boolean).join(', ') || null,
    approximateOrigin: {
      latitude: Number(Number(config.origin_latitude).toFixed(2)),
      longitude: Number(Number(config.origin_longitude).toFixed(2)),
    },
  };
};

export const setMobileConfig = async (userId: string, input: SetMobileConfigRequest) => {
  const profile = await profileForUser(userId);
  if (input.isEnabled && profile.subscription_tier === 'FREE') {
    throw new AppError(
      403,
      'Mobile barber requires BASIC or PREMIUM subscription.',
      'SUBSCRIPTION_REQUIRED',
      {
        requiredTier: 'BASIC',
        upgradeUrl: '/barbers/me/subscription/checkout',
      },
    );
  }
  const rows = await query<Row>(
    `INSERT INTO mobile_barber_config
      (barber_id,is_enabled,service_radius_miles,fee_structure,base_fee_cents,per_mile_rate_cents,
       origin_latitude,origin_longitude,origin_address,mobile_service_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (barber_id) DO UPDATE SET
       is_enabled=EXCLUDED.is_enabled,service_radius_miles=EXCLUDED.service_radius_miles,
       fee_structure=EXCLUDED.fee_structure,base_fee_cents=EXCLUDED.base_fee_cents,
       per_mile_rate_cents=EXCLUDED.per_mile_rate_cents,origin_latitude=EXCLUDED.origin_latitude,
       origin_longitude=EXCLUDED.origin_longitude,origin_address=EXCLUDED.origin_address,
       mobile_service_notes=EXCLUDED.mobile_service_notes
     RETURNING *`,
    [
      profile.id,
      input.isEnabled,
      input.serviceRadiusMiles,
      input.feeStructure,
      input.baseFeeCents,
      input.perMileRateCents,
      input.originLatitude,
      input.originLongitude,
      input.originAddress ?? null,
      input.mobileServiceNotes ?? null,
    ],
  );
  return mapMobileConfig(rows[0]);
};

export const disableMobileConfig = async (userId: string) => {
  const profile = await profileForUser(userId);
  await query('UPDATE mobile_barber_config SET is_enabled = false WHERE barber_id = $1', [
    profile.id,
  ]);
  return { isEnabled: false, message: 'Mobile service disabled.' };
};

export const requireEnabledMobileConfig = async (
  barberId: string,
  executor?: DatabaseExecutor,
): Promise<Row> => {
  const rows = await query<Row>(
    'SELECT * FROM mobile_barber_config WHERE barber_id = $1 AND is_enabled = true',
    [barberId],
    executor,
  );
  if (rows[0] === undefined)
    throw new AppError(
      400,
      'This barber does not offer mobile service.',
      'MOBILE_SERVICE_UNAVAILABLE',
    );
  return rows[0];
};

export const calculateTravelFeeCents = (config: Row, distanceMiles: number): number => {
  if (config.fee_structure === 'free') return 0;
  if (config.fee_structure === 'per_mile')
    return Math.ceil(distanceMiles) * Number(config.per_mile_rate_cents);
  return Number(config.base_fee_cents);
};

export const estimateTravel = async (input: TravelEstimateRequest) => {
  const config = await requireEnabledMobileConfig(input.barberId);
  const metrics = await getTravelMetrics(
    { latitude: Number(config.origin_latitude), longitude: Number(config.origin_longitude) },
    { latitude: input.destinationLatitude, longitude: input.destinationLongitude },
  );
  const radius = Number(config.service_radius_miles);
  if (metrics.distanceMiles > radius) {
    throw new AppError(
      400,
      `This address is ${metrics.distanceMiles} miles away, outside the barber's ${radius}-mile service area.`,
      'OUTSIDE_SERVICE_AREA',
      {
        distanceMiles: metrics.distanceMiles,
        serviceRadiusMiles: radius,
      },
    );
  }
  const travelFeeCents = calculateTravelFeeCents(config, metrics.distanceMiles);
  return {
    isWithinRadius: true,
    distanceMiles: metrics.distanceMiles,
    estimatedTravelMinutes: metrics.travelMinutes,
    travelFeeCents,
    travelFee: travelFeeCents / 100,
    breakdown: {
      serviceArea: `${radius} miles`,
      feeStructure: config.fee_structure,
      calculation:
        config.fee_structure === 'flat'
          ? `Flat fee of $${(travelFeeCents / 100).toFixed(2)}`
          : config.fee_structure === 'per_mile'
            ? `${Math.ceil(metrics.distanceMiles)} miles at $${(Number(config.per_mile_rate_cents) / 100).toFixed(2)}/mile`
            : 'No travel fee',
    },
    source: metrics.source,
  };
};
