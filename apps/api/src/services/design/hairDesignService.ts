/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type { CreateHairDesignRequest } from '@barber-saas/shared-types';

import { query, withTransaction } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';

type Row = Record<string, unknown>;
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const mapDesign = (row: Row) => ({
  id: row.id,
  styleName: row.style_name,
  styleCategory: row.style_category,
  description: row.description,
  sourcePhotoUrl: row.source_photo_url,
  generatedPreviewUrl: row.generated_preview_url,
  aiStatus: row.ai_status,
  appointmentId: row.appointment_id,
  createdAt: iso(row.created_at),
});

export const createHairDesign = async (clientId: string, input: CreateHairDesignRequest) => {
  const rows = await query<Row>(
    `INSERT INTO client_hair_designs
      (client_id,style_name,style_category,description,source_photo_url,ai_status)
     VALUES ($1,$2,$3,$4,$5,'placeholder') RETURNING *`,
    [
      clientId,
      input.styleName,
      input.styleCategory,
      input.description ?? null,
      input.sourcePhotoUrl ?? null,
    ],
  );
  return mapDesign(rows[0] as Row);
};

export const listHairDesigns = async (clientId: string) => {
  const rows = await query<Row>(
    `SELECT * FROM client_hair_designs
     WHERE client_id=$1 AND is_saved=true ORDER BY created_at DESC`,
    [clientId],
  );
  return { designs: rows.map(mapDesign) };
};

export const attachHairDesign = async (clientId: string, designId: string, appointmentId: string) =>
  withTransaction(async (client) => {
    const designs = await query<Row>(
      'SELECT * FROM client_hair_designs WHERE id=$1 AND client_id=$2 FOR UPDATE',
      [designId, clientId],
      client,
    );
    const design = designs[0];
    if (design === undefined) throw new AppError(404, 'Design not found.', 'DESIGN_NOT_FOUND');
    const appointments = await query<Row>(
      'SELECT id FROM appointments WHERE id=$1 AND client_id=$2 FOR UPDATE',
      [appointmentId, clientId],
      client,
    );
    if (appointments.length === 0) {
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    }
    await client.query('UPDATE appointments SET style_reference_id=$1,style_notes=$2 WHERE id=$3', [
      designId,
      design.description,
      appointmentId,
    ]);
    await client.query(
      'UPDATE client_hair_designs SET appointment_id=$1 WHERE id=$2 AND client_id=$3',
      [appointmentId, designId, clientId],
    );
    return { message: 'Style reference attached to appointment.', appointmentId };
  });
