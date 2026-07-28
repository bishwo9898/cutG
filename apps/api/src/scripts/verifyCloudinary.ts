import {
  deletePrivateCloudinaryImage,
  isCloudinaryEnabled,
  storePrivateCloudinaryImage,
} from '../services/storage/cloudinaryStorage';

// A valid 1x1 PNG used only to prove that the configured server credential can upload and delete
// authenticated assets. No customer image is involved in this check.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const run = async (): Promise<void> => {
  if (!isCloudinaryEnabled()) {
    throw new Error(
      'Cloudinary is not configured. Copy the complete cloudinary://API_KEY:API_SECRET@CLOUD_NAME value into CLOUDINARY_URL.',
    );
  }

  const testId = `connection-tests/verify-${Date.now()}`;
  let uploadedPublicId: string | null = null;

  try {
    const uploaded = await storePrivateCloudinaryImage(
      {
        body: TEST_PNG,
        contentType: 'image/png',
        sizeBytes: TEST_PNG.length,
      },
      testId,
    );
    uploadedPublicId = uploaded.publicId;
    console.info(
      `Cloudinary upload verified (${uploaded.width}x${uploaded.height}, ${uploaded.bytes} bytes).`,
    );
  } finally {
    if (uploadedPublicId !== null) {
      await deletePrivateCloudinaryImage(uploadedPublicId);
      console.info('Verification asset deleted.');
    }
  }
};

void run().catch((error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'http_code' in error &&
    error.http_code === 403
  ) {
    console.error(
      'Cloudinary accepted the credential but denied asset creation (HTTP 403). In Cloudinary Console, assign this product-environment API key a role that permits creating and deleting assets, then rerun this command.',
    );
    process.exitCode = 1;
    return;
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
