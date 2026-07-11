/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type {
  OneTimeAddressRequest,
  SaveAddressRequest,
  UpdateAddressRequest,
} from '@barber-saas/shared-types';

import { env } from '../../config/env';
import { query, withTransaction, type DatabaseExecutor } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';

type Row = Record<string, unknown>;
type AddressInput = OneTimeAddressRequest | SaveAddressRequest;
type GeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

export type ResolvedAddress = {
  id?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

const fullAddress = (input: AddressInput): string =>
  [input.addressLine1, input.addressLine2, input.city, input.state, input.zipCode, input.country]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');

export const geocodeAddress = async (
  input: AddressInput,
  fetcher: typeof fetch = fetch,
): Promise<ResolvedAddress> => {
  const formattedAddress = fullAddress(input);
  if (env.GOOGLE_MAPS_API_KEY.length === 0 || env.NODE_ENV === 'test') {
    return {
      addressLine1: input.addressLine1,
      ...(input.addressLine2 === undefined ? {} : { addressLine2: input.addressLine2 }),
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      latitude: 40.6892,
      longitude: -73.9851,
      formattedAddress,
    };
  }

  const parameters = new URLSearchParams({
    address: formattedAddress,
    key: env.GOOGLE_MAPS_API_KEY,
  });
  let response: Response;
  try {
    response = await fetcher(
      `https://maps.googleapis.com/maps/api/geocode/json?${parameters.toString()}`,
    );
  } catch {
    throw new AppError(503, 'Address lookup is temporarily unavailable.', 'MAPS_UNAVAILABLE');
  }
  const body = (await response.json()) as GeocodeResponse;
  const result = body.results?.[0];
  const latitude = result?.geometry?.location?.lat;
  const longitude = result?.geometry?.location?.lng;
  if (!response.ok || body.status !== 'OK' || latitude === undefined || longitude === undefined) {
    throw new AppError(
      422,
      'Could not locate this address. Please check and try again.',
      'ADDRESS_NOT_FOUND',
    );
  }
  return {
    addressLine1: input.addressLine1,
    ...(input.addressLine2 === undefined ? {} : { addressLine2: input.addressLine2 }),
    city: input.city,
    state: input.state,
    zipCode: input.zipCode,
    country: input.country,
    latitude,
    longitude,
    formattedAddress: result?.formatted_address ?? formattedAddress,
  };
};

export const mapClientAddress = (row: Row) => ({
  id: row.id,
  label: row.label,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  city: row.city,
  state: row.state,
  zipCode: row.zip_code,
  country: row.country,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  isDefault: row.is_default,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

export const getOwnedAddress = async (
  clientId: string,
  addressId: string,
  executor?: DatabaseExecutor,
): Promise<Row> => {
  const rows = await query<Row>(
    'SELECT * FROM client_addresses WHERE id = $1 AND client_id = $2',
    [addressId, clientId],
    executor,
  );
  if (rows[0] === undefined) throw new AppError(404, 'Address not found.', 'ADDRESS_NOT_FOUND');
  return rows[0];
};

export const listClientAddresses = async (clientId: string) => {
  const rows = await query<Row>(
    'SELECT * FROM client_addresses WHERE client_id = $1 ORDER BY is_default DESC, created_at DESC',
    [clientId],
  );
  return { addresses: rows.map(mapClientAddress) };
};

export const createClientAddress = async (clientId: string, input: SaveAddressRequest) => {
  const resolved = await geocodeAddress(input);
  return withTransaction(async (trx) => {
    const countRows = await query<Row>(
      'SELECT COUNT(*)::int AS count FROM client_addresses WHERE client_id = $1',
      [clientId],
      trx,
    );
    const rows = await query<Row>(
      `INSERT INTO client_addresses
        (client_id,label,address_line1,address_line2,city,state,zip_code,country,latitude,longitude,is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        clientId,
        input.label,
        input.addressLine1,
        input.addressLine2 ?? null,
        input.city,
        input.state,
        input.zipCode,
        input.country,
        resolved.latitude,
        resolved.longitude,
        Number(countRows[0]?.count ?? 0) === 0,
      ],
      trx,
    );
    return mapClientAddress(rows[0] as Row);
  });
};

export const updateClientAddress = async (
  clientId: string,
  addressId: string,
  input: UpdateAddressRequest,
) => {
  const existing = await getOwnedAddress(clientId, addressId);
  const locationChanged = [
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'zipCode',
    'country',
  ].some((key) => Object.hasOwn(input, key));
  const merged: SaveAddressRequest = {
    label: input.label ?? String(existing.label),
    addressLine1: input.addressLine1 ?? String(existing.address_line1),
    addressLine2:
      input.addressLine2 ??
      (existing.address_line2 === null ? undefined : String(existing.address_line2)),
    city: input.city ?? String(existing.city),
    state: input.state ?? String(existing.state),
    zipCode: input.zipCode ?? String(existing.zip_code),
    country: input.country ?? String(existing.country),
  };
  const resolved = locationChanged
    ? await geocodeAddress(merged)
    : { latitude: Number(existing.latitude), longitude: Number(existing.longitude) };
  const rows = await query<Row>(
    `UPDATE client_addresses SET label=$1,address_line1=$2,address_line2=$3,city=$4,state=$5,
      zip_code=$6,country=$7,latitude=$8,longitude=$9 WHERE id=$10 AND client_id=$11 RETURNING *`,
    [
      merged.label,
      merged.addressLine1,
      merged.addressLine2 ?? null,
      merged.city,
      merged.state,
      merged.zipCode,
      merged.country,
      resolved.latitude,
      resolved.longitude,
      addressId,
      clientId,
    ],
  );
  return mapClientAddress(rows[0] as Row);
};

export const deleteClientAddress = async (clientId: string, addressId: string) =>
  withTransaction(async (trx) => {
    const address = await getOwnedAddress(clientId, addressId, trx);
    await query(
      'DELETE FROM client_addresses WHERE id = $1 AND client_id = $2',
      [addressId, clientId],
      trx,
    );
    if (address.is_default === true) {
      await query(
        `UPDATE client_addresses SET is_default = true WHERE id = (
          SELECT id FROM client_addresses WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1
        )`,
        [clientId],
        trx,
      );
    }
    return { message: 'Address removed.' };
  });

export const setDefaultClientAddress = async (clientId: string, addressId: string) =>
  withTransaction(async (trx) => {
    await getOwnedAddress(clientId, addressId, trx);
    await query(
      'UPDATE client_addresses SET is_default = false WHERE client_id = $1',
      [clientId],
      trx,
    );
    const rows = await query<Row>(
      'UPDATE client_addresses SET is_default = true WHERE id = $1 RETURNING *',
      [addressId],
      trx,
    );
    return mapClientAddress(rows[0] as Row);
  });
