import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import { env } from '../../config/env';

import type { DownloadedImage } from './objectStorage';

export type CloudinaryImage = {
  publicId: string;
  version: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

export const isCloudinaryEnabled = (): boolean => env.CLOUDINARY_URL.trim().length > 0;

let cloudinaryConfigured = false;
const ensureCloudinary = (): void => {
  if (!isCloudinaryEnabled()) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_URL to the API environment.');
  }
  if (!cloudinaryConfigured) {
    cloudinary.config(true);
    cloudinaryConfigured = true;
  }
};

export const storePrivateCloudinaryImage = async (
  image: DownloadedImage,
  publicId: string,
): Promise<CloudinaryImage> => {
  ensureCloudinary();
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: `${env.CLOUDINARY_FOLDER}/${publicId}`,
        resource_type: 'image',
        type: 'authenticated',
        overwrite: true,
        invalidate: true,
        unique_filename: false,
        use_filename: false,
      },
      (error, uploaded) => {
        if (error !== undefined) {
          reject(error);
          return;
        }
        if (uploaded === undefined) {
          reject(new Error('Cloudinary did not return an uploaded image.'));
          return;
        }
        resolve(uploaded);
      },
    );
    stream.end(image.body);
  });

  return {
    publicId: result.public_id,
    version: result.version,
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
};

export const createPrivateCloudinaryUrl = (asset: {
  publicId: string;
  version?: number | null;
  format?: string | null;
}): string => {
  ensureCloudinary();
  return cloudinary.url(asset.publicId, {
    secure: true,
    sign_url: true,
    resource_type: 'image',
    type: 'authenticated',
    ...(asset.version === undefined || asset.version === null ? {} : { version: asset.version }),
    ...(asset.format === undefined || asset.format === null ? {} : { format: asset.format }),
  });
};

export const deletePrivateCloudinaryImage = async (publicId: string): Promise<void> => {
  if (!isCloudinaryEnabled()) return;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    type: 'authenticated',
    invalidate: true,
  });
};
