/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type {
  CreateCertificationRequest,
  CreatePortfolioItemRequest,
  CreateWorkExperienceRequest,
  UpdateCertificationRequest,
  UpdatePortfolioItemRequest,
  UpdateWorkExperienceRequest,
} from '@barber-saas/shared-types';

import { query } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import {
  createPublicCloudinaryAssetUrl,
  createPublicCloudinaryUrl,
  deletePublicCloudinaryAsset,
  deletePublicCloudinaryImage,
  isCloudinaryEnabled,
  storePublicCloudinaryAsset,
  storePublicCloudinaryImage,
} from '../storage/cloudinaryStorage';
import type { DownloadedImage } from '../storage/objectStorage';

import { findBarberProfile } from './barberService';

type Row = Record<string, unknown>;
type PortfolioSide = 'before' | 'after';

const profileNotFound = () =>
  new AppError(404, 'Barber profile does not exist. Create one first.', 'BARBER_PROFILE_NOT_FOUND');
const itemNotFound = () =>
  new AppError(404, 'Portfolio work was not found.', 'PORTFOLIO_ITEM_NOT_FOUND');
const experienceNotFound = () =>
  new AppError(404, 'Work experience was not found.', 'WORK_EXPERIENCE_NOT_FOUND');
const certificationNotFound = () =>
  new AppError(404, 'Certification was not found.', 'CERTIFICATION_NOT_FOUND');
const date = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const dateTime = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const requireProfile = async (userId: string): Promise<Row> => {
  const profile = await findBarberProfile(userId);
  if (profile === null) throw profileNotFound();
  return profile;
};

const mapPortfolioItem = (row: Row) => ({
  id: row.id,
  barberId: row.barber_id,
  title: row.title,
  description: row.description,
  category: row.category,
  hairType: row.hair_type,
  hairDensity: row.hair_density,
  hairLengthBefore: row.hair_length_before,
  hairLengthAfter: row.hair_length_after,
  faceShape: row.face_shape,
  cutStyle: row.cut_style,
  timeTakenMinutes: Number(row.time_taken_minutes),
  productsUsed: stringArray(row.products_used),
  difficulty: row.difficulty,
  beforeImageUrl: row.before_image_url,
  afterImageUrl: row.after_image_url,
  isPublished: row.is_published,
  isFeatured: row.is_featured,
  displayOrder: Number(row.display_order),
  createdAt: dateTime(row.created_at),
  updatedAt: dateTime(row.updated_at),
});

const mapExperience = (row: Row) => ({
  id: row.id,
  shopName: row.shop_name,
  title: row.title,
  location: row.location,
  startDate: date(row.start_date),
  endDate: row.end_date === null ? null : date(row.end_date),
  isCurrent: row.is_current,
  description: row.description,
});

const mapCertification = (row: Row) => ({
  id: row.id,
  name: row.name,
  issuer: row.issuer,
  issueDate: row.issue_date === null ? null : date(row.issue_date),
  expirationDate: row.expiration_date === null ? null : date(row.expiration_date),
  credentialId: row.credential_id,
  credentialUrl: row.credential_url,
});

const requireOwnedItem = async (userId: string, itemId: string): Promise<Row> => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    'SELECT * FROM barber_portfolio_items WHERE id=$1 AND barber_id=$2',
    [itemId, profile.id],
  );
  const item = rows[0];
  if (item === undefined) throw itemNotFound();
  return item;
};

const requireOwnedExperience = async (userId: string, experienceId: string): Promise<Row> => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    'SELECT * FROM barber_work_experiences WHERE id=$1 AND barber_id=$2',
    [experienceId, profile.id],
  );
  const experience = rows[0];
  if (experience === undefined) throw experienceNotFound();
  return experience;
};

const requireOwnedCertification = async (userId: string, certificationId: string): Promise<Row> => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    'SELECT * FROM barber_certifications WHERE id=$1 AND barber_id=$2',
    [certificationId, profile.id],
  );
  const certification = rows[0];
  if (certification === undefined) throw certificationNotFound();
  return certification;
};

const trustMetrics = async (barberId: unknown) => {
  const summaryRows = await query<Row>(
    `WITH completed AS (
       SELECT client_id,scheduled_at,
         LAG(scheduled_at) OVER (PARTITION BY client_id ORDER BY scheduled_at) AS previous_visit
       FROM appointments
       WHERE barber_id=$1 AND status='COMPLETED'
     ),
     clients AS (
       SELECT client_id,
         BOOL_OR(
           previous_visit IS NOT NULL
           AND scheduled_at <= previous_visit + INTERVAL '60 days'
         ) AS returned_within_60_days
       FROM completed
       GROUP BY client_id
     )
     SELECT
       COUNT(*)::int AS total_clients,
       COUNT(*) FILTER (WHERE returned_within_60_days)::int AS repeat_clients
     FROM clients`,
    [barberId],
  );
  const summary = summaryRows[0] ?? {};
  const totalClients = Number(summary.total_clients ?? 0);
  const repeatClients = Number(summary.repeat_clients ?? 0);

  const monthlyRows = await query<Row>(
    `WITH months AS (
       SELECT generate_series(
         date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
         date_trunc('month', CURRENT_DATE),
         INTERVAL '1 month'
       ) AS month
     ),
     completed AS (
       SELECT client_id,scheduled_at
       FROM appointments
       WHERE barber_id=$1 AND status='COMPLETED'
     ),
     repeat_visits AS (
       SELECT current_visit.client_id,date_trunc('month',current_visit.scheduled_at) AS month
       FROM completed current_visit
       WHERE EXISTS (
         SELECT 1
         FROM completed prior_visit
         WHERE prior_visit.client_id=current_visit.client_id
           AND prior_visit.scheduled_at < current_visit.scheduled_at
           AND prior_visit.scheduled_at >= current_visit.scheduled_at - INTERVAL '60 days'
       )
     )
     SELECT to_char(months.month,'YYYY-MM') AS month,
       COUNT(DISTINCT repeat_visits.client_id)::int AS repeat_clients
     FROM months
     LEFT JOIN repeat_visits ON repeat_visits.month=months.month
     GROUP BY months.month
     ORDER BY months.month`,
    [barberId],
  );

  return {
    totalClients,
    repeatClients,
    repeatClientPercentage:
      totalClients === 0 ? null : Math.round((repeatClients / totalClients) * 100),
    windowDays: 60,
    monthlyRepeatClients: monthlyRows.map((row) => ({
      month: String(row.month),
      repeatClients: Number(row.repeat_clients),
    })),
  };
};

export const getMyPortfolio = async (userId: string) => {
  const profile = await requireProfile(userId);
  const [items, experiences, certifications, trust] = await Promise.all([
    query<Row>(
      'SELECT * FROM barber_portfolio_items WHERE barber_id=$1 ORDER BY display_order,created_at DESC',
      [profile.id],
    ),
    query<Row>(
      'SELECT * FROM barber_work_experiences WHERE barber_id=$1 ORDER BY is_current DESC,display_order,start_date DESC',
      [profile.id],
    ),
    query<Row>(
      'SELECT * FROM barber_certifications WHERE barber_id=$1 ORDER BY display_order,issue_date DESC NULLS LAST',
      [profile.id],
    ),
    trustMetrics(profile.id),
  ]);
  return {
    items: items.map(mapPortfolioItem),
    experiences: experiences.map(mapExperience),
    certifications: certifications.map(mapCertification),
    trust,
  };
};

export const getPublicPortfolio = async (barberId: string) => {
  const profiles = await query<Row>('SELECT id FROM barber_profiles WHERE id=$1', [barberId]);
  if (profiles[0] === undefined) throw profileNotFound();
  const [items, experiences, certifications, trust, nextSlots] = await Promise.all([
    query<Row>(
      `SELECT * FROM barber_portfolio_items
       WHERE barber_id=$1 AND is_published=true
       ORDER BY is_featured DESC,display_order,created_at DESC`,
      [barberId],
    ),
    query<Row>(
      'SELECT * FROM barber_work_experiences WHERE barber_id=$1 ORDER BY is_current DESC,display_order,start_date DESC',
      [barberId],
    ),
    query<Row>(
      'SELECT * FROM barber_certifications WHERE barber_id=$1 ORDER BY display_order,issue_date DESC NULLS LAST',
      [barberId],
    ),
    trustMetrics(barberId),
    query<Row>(
      `SELECT slot_date,start_time
       FROM availability_slots
       WHERE barber_id=$1 AND status='AVAILABLE' AND is_travel_buffer=false
         AND (slot_date > CURRENT_DATE OR (slot_date=CURRENT_DATE AND start_time>CURRENT_TIME))
       ORDER BY slot_date,start_time
       LIMIT 1`,
      [barberId],
    ),
  ]);
  const nextSlot = nextSlots[0];
  return {
    items: items.map(mapPortfolioItem),
    experiences: experiences.map(mapExperience),
    certifications: certifications.map(mapCertification),
    trust,
    nextAvailableAppointment:
      nextSlot === undefined
        ? null
        : { date: date(nextSlot.slot_date), startTime: String(nextSlot.start_time).slice(0, 5) },
  };
};

export const createPortfolioItem = async (userId: string, input: CreatePortfolioItemRequest) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    `INSERT INTO barber_portfolio_items
      (barber_id,title,description,category,hair_type,hair_density,hair_length_before,
       hair_length_after,face_shape,cut_style,time_taken_minutes,products_used,difficulty,is_featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
     RETURNING *`,
    [
      profile.id,
      input.title,
      input.description ?? null,
      input.category,
      input.hairType,
      input.hairDensity,
      input.hairLengthBefore,
      input.hairLengthAfter,
      input.faceShape,
      input.cutStyle,
      input.timeTakenMinutes,
      JSON.stringify(input.productsUsed),
      input.difficulty,
      input.isFeatured ?? false,
    ],
  );
  return mapPortfolioItem(rows[0] as Row);
};

export const updatePortfolioItem = async (
  userId: string,
  itemId: string,
  input: UpdatePortfolioItemRequest,
) => {
  await requireOwnedItem(userId, itemId);
  const mapping: Record<string, string> = {
    title: 'title',
    description: 'description',
    category: 'category',
    hairType: 'hair_type',
    hairDensity: 'hair_density',
    hairLengthBefore: 'hair_length_before',
    hairLengthAfter: 'hair_length_after',
    faceShape: 'face_shape',
    cutStyle: 'cut_style',
    timeTakenMinutes: 'time_taken_minutes',
    productsUsed: 'products_used',
    difficulty: 'difficulty',
    isFeatured: 'is_featured',
  };
  const entries = Object.entries(input);
  const values = entries.map(([key, value]) =>
    key === 'productsUsed' ? JSON.stringify(value) : value,
  );
  const sets = entries.map(([key], index) => `${mapping[key]}=$${index + 1}`);
  values.push(itemId);
  const rows = await query<Row>(
    `UPDATE barber_portfolio_items SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return mapPortfolioItem(rows[0] as Row);
};

export const uploadPortfolioImage = async (
  userId: string,
  itemId: string,
  side: PortfolioSide,
  image: DownloadedImage,
) => {
  const item = await requireOwnedItem(userId, itemId);
  if (!isCloudinaryEnabled()) {
    throw new AppError(
      503,
      'Portfolio image uploads are temporarily unavailable.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
  const uploaded = await storePublicCloudinaryImage(
    image,
    `portfolio/gallery/${String(item.barber_id)}/${itemId}/${side}`,
  );
  const imageUrl = createPublicCloudinaryUrl(uploaded);
  const prefix = side === 'before' ? 'before' : 'after';
  const oldPublicId =
    typeof item[`${prefix}_cloudinary_public_id`] === 'string'
      ? String(item[`${prefix}_cloudinary_public_id`])
      : null;
  const otherUrl = side === 'before' ? item.after_image_url : item.before_image_url;
  const rows = await query<Row>(
    `UPDATE barber_portfolio_items
     SET ${prefix}_image_url=$1,${prefix}_cloudinary_public_id=$2,
       ${prefix}_cloudinary_version=$3,${prefix}_cloudinary_format=$4,
       is_published=($1 IS NOT NULL AND $5::text IS NOT NULL)
     WHERE id=$6 RETURNING *`,
    [imageUrl, uploaded.publicId, uploaded.version, uploaded.format, otherUrl, itemId],
  );
  if (oldPublicId !== null && oldPublicId !== uploaded.publicId) {
    await deletePublicCloudinaryImage(oldPublicId);
  }
  return mapPortfolioItem(rows[0] as Row);
};

export const deletePortfolioItem = async (userId: string, itemId: string) => {
  const item = await requireOwnedItem(userId, itemId);
  await query('DELETE FROM barber_portfolio_items WHERE id=$1', [itemId]);
  const publicIds = [item.before_cloudinary_public_id, item.after_cloudinary_public_id].filter(
    (value): value is string => typeof value === 'string',
  );
  await Promise.all(publicIds.map((publicId) => deletePublicCloudinaryImage(publicId)));
  return { message: 'Portfolio work removed.', itemId };
};

export const uploadProfilePhoto = async (userId: string, image: DownloadedImage) => {
  const profile = await requireProfile(userId);
  if (!isCloudinaryEnabled()) {
    throw new AppError(
      503,
      'Profile image uploads are temporarily unavailable.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
  const uploaded = await storePublicCloudinaryImage(
    image,
    `portfolio/profiles/${String(profile.id)}/portrait`,
  );
  const photoUrl = createPublicCloudinaryUrl(uploaded);
  const rows = await query<Row>(
    `UPDATE barber_profiles
     SET profile_photo_url=$1,profile_photo_cloudinary_public_id=$2,
       profile_photo_cloudinary_version=$3,profile_photo_cloudinary_format=$4
     WHERE id=$5 RETURNING *`,
    [photoUrl, uploaded.publicId, uploaded.version, uploaded.format, profile.id],
  );
  return { profilePhotoUrl: rows[0]?.profile_photo_url };
};

export const uploadProfileBanner = async (
  userId: string,
  asset: DownloadedImage,
  resourceType: 'image' | 'video',
) => {
  const profile = await requireProfile(userId);
  if (!isCloudinaryEnabled()) {
    throw new AppError(
      503,
      'Portfolio banner uploads are temporarily unavailable.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
  const uploaded = await storePublicCloudinaryAsset(
    asset,
    `portfolio/profiles/${String(profile.id)}/banner`,
    resourceType,
  );
  const bannerUrl = createPublicCloudinaryAssetUrl(uploaded);
  const previousPublicId =
    typeof profile.banner_cloudinary_public_id === 'string'
      ? profile.banner_cloudinary_public_id
      : null;
  const previousType = profile.banner_asset_type === 'video' ? 'video' : 'image';
  await query(
    `UPDATE barber_profiles
     SET banner_url=$1,banner_asset_type=$2,banner_cloudinary_public_id=$3,
       banner_cloudinary_version=$4,banner_cloudinary_format=$5
     WHERE id=$6`,
    [bannerUrl, resourceType, uploaded.publicId, uploaded.version, uploaded.format, profile.id],
  );
  if (
    previousPublicId !== null &&
    (previousPublicId !== uploaded.publicId || previousType !== resourceType)
  ) {
    await deletePublicCloudinaryAsset(previousPublicId, previousType);
  }
  return { bannerUrl, bannerAssetType: resourceType };
};

export const removeProfileBanner = async (userId: string) => {
  const profile = await requireProfile(userId);
  const publicId =
    typeof profile.banner_cloudinary_public_id === 'string'
      ? profile.banner_cloudinary_public_id
      : null;
  const resourceType = profile.banner_asset_type === 'video' ? 'video' : 'image';
  await query(
    `UPDATE barber_profiles
     SET banner_url=NULL,banner_asset_type=NULL,banner_cloudinary_public_id=NULL,
       banner_cloudinary_version=NULL,banner_cloudinary_format=NULL
     WHERE id=$1`,
    [profile.id],
  );
  if (publicId !== null) await deletePublicCloudinaryAsset(publicId, resourceType);
  return { bannerUrl: null, bannerAssetType: null };
};

export const completePortfolioOnboarding = async (userId: string) => {
  const profile = await requireProfile(userId);
  const missing = [
    typeof profile.headline !== 'string' || profile.headline.trim().length === 0
      ? 'headline'
      : null,
    typeof profile.bio !== 'string' || profile.bio.trim().length === 0 ? 'bio' : null,
    profile.years_of_experience === null ? 'yearsOfExperience' : null,
    stringArray(profile.languages).length === 0 ? 'languages' : null,
  ].filter((value): value is string => value !== null);
  if (missing.length > 0) {
    throw new AppError(
      422,
      'Add the essential portfolio details before continuing.',
      'PORTFOLIO_INCOMPLETE',
      { missing },
    );
  }
  const rows = await query<Row>(
    `UPDATE barber_profiles
     SET portfolio_completed_at=COALESCE(portfolio_completed_at,CURRENT_TIMESTAMP)
     WHERE id=$1 RETURNING portfolio_completed_at`,
    [profile.id],
  );
  return {
    portfolioCompletedAt: dateTime(rows[0]?.portfolio_completed_at),
    message: 'Your portfolio foundation is ready.',
  };
};

export const createWorkExperience = async (userId: string, input: CreateWorkExperienceRequest) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    `INSERT INTO barber_work_experiences
      (barber_id,shop_name,title,location,start_date,end_date,is_current,description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      profile.id,
      input.shopName,
      input.title,
      input.location ?? null,
      input.startDate,
      input.isCurrent ? null : (input.endDate ?? null),
      input.isCurrent,
      input.description ?? null,
    ],
  );
  return mapExperience(rows[0] as Row);
};

export const updateWorkExperience = async (
  userId: string,
  experienceId: string,
  input: UpdateWorkExperienceRequest,
) => {
  await requireOwnedExperience(userId, experienceId);
  const normalized = {
    ...input,
    ...(input.isCurrent === true ? { endDate: null } : {}),
  };
  const mapping: Record<string, string> = {
    shopName: 'shop_name',
    title: 'title',
    location: 'location',
    startDate: 'start_date',
    endDate: 'end_date',
    isCurrent: 'is_current',
    description: 'description',
  };
  const entries = Object.entries(normalized);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${mapping[key]}=$${index + 1}`);
  values.push(experienceId);
  const rows = await query<Row>(
    `UPDATE barber_work_experiences SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return mapExperience(rows[0] as Row);
};

export const deleteWorkExperience = async (userId: string, experienceId: string) => {
  await requireOwnedExperience(userId, experienceId);
  await query('DELETE FROM barber_work_experiences WHERE id=$1', [experienceId]);
  return { message: 'Work experience removed.', experienceId };
};

export const createCertification = async (userId: string, input: CreateCertificationRequest) => {
  const profile = await requireProfile(userId);
  const rows = await query<Row>(
    `INSERT INTO barber_certifications
      (barber_id,name,issuer,issue_date,expiration_date,credential_id,credential_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      profile.id,
      input.name,
      input.issuer,
      input.issueDate ?? null,
      input.expirationDate ?? null,
      input.credentialId ?? null,
      input.credentialUrl ?? null,
    ],
  );
  return mapCertification(rows[0] as Row);
};

export const updateCertification = async (
  userId: string,
  certificationId: string,
  input: UpdateCertificationRequest,
) => {
  await requireOwnedCertification(userId, certificationId);
  const mapping: Record<string, string> = {
    name: 'name',
    issuer: 'issuer',
    issueDate: 'issue_date',
    expirationDate: 'expiration_date',
    credentialId: 'credential_id',
    credentialUrl: 'credential_url',
  };
  const entries = Object.entries(input);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${mapping[key]}=$${index + 1}`);
  values.push(certificationId);
  const rows = await query<Row>(
    `UPDATE barber_certifications SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return mapCertification(rows[0] as Row);
};

export const deleteCertification = async (userId: string, certificationId: string) => {
  await requireOwnedCertification(userId, certificationId);
  await query('DELETE FROM barber_certifications WHERE id=$1', [certificationId]);
  return { message: 'Certification removed.', certificationId };
};
