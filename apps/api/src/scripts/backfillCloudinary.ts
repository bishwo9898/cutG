import { closeDatabase } from '../config/database';
import { query } from '../db/queries/barber.queries';
import {
  isCloudinaryEnabled,
  storePrivateCloudinaryImage,
} from '../services/storage/cloudinaryStorage';
import { createPresignedDownloadUrl, downloadRemoteImage } from '../services/storage/objectStorage';

type Row = {
  id: string;
  client_id: string;
  source_asset_key: string | null;
  generated_asset_key: string | null;
};

const run = async (): Promise<void> => {
  if (!isCloudinaryEnabled()) {
    throw new Error(
      'Set CLOUDINARY_URL to the complete cloudinary://API_KEY:API_SECRET@CLOUD_NAME value before running the Cloudinary backfill.',
    );
  }
  const designs = await query<Row>(
    `SELECT id,client_id,source_asset_key,generated_asset_key
     FROM client_hair_designs
     WHERE is_saved=true AND deleted_at IS NULL AND ai_status='completed'
       AND (source_cloudinary_public_id IS NULL OR generated_cloudinary_public_id IS NULL)
     ORDER BY created_at`,
  );
  let migrated = 0;
  let skipped = 0;

  for (const design of designs) {
    if (design.source_asset_key === null || design.generated_asset_key === null) {
      skipped += 1;
      continue;
    }
    try {
      const [sourceImage, generatedImage] = await Promise.all([
        downloadRemoteImage(await createPresignedDownloadUrl(design.source_asset_key)),
        downloadRemoteImage(await createPresignedDownloadUrl(design.generated_asset_key)),
      ]);
      const [source, generated] = await Promise.all([
        storePrivateCloudinaryImage(
          sourceImage,
          `users/${design.client_id}/looks/${design.id}/original`,
        ),
        storePrivateCloudinaryImage(
          generatedImage,
          `users/${design.client_id}/looks/${design.id}/preview`,
        ),
      ]);
      await query(
        `UPDATE client_hair_designs SET
           source_cloudinary_public_id=$1,source_cloudinary_version=$2,source_cloudinary_format=$3,
           generated_cloudinary_public_id=$4,generated_cloudinary_version=$5,
           generated_cloudinary_format=$6
         WHERE id=$7`,
        [
          source.publicId,
          source.version,
          source.format,
          generated.publicId,
          generated.version,
          generated.format,
          design.id,
        ],
      );
      migrated += 1;
    } catch (error) {
      skipped += 1;
      console.warn(
        `Skipped saved look ${design.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  console.info(`Cloudinary backfill complete: ${migrated} migrated, ${skipped} skipped.`);
};

const main = async (): Promise<void> => {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
};

void main();
