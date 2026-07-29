import { createRequire } from 'node:module';

import type { UploadApiResponse, v2 as CloudinaryV2 } from 'cloudinary';

import { env, isCompleteCloudinaryUrl } from '../../config/env';

import type { DownloadedImage } from './objectStorage';

// Cloudinary reads CLOUDINARY_URL as soon as its runtime module loads. Loading it after our
// environment module lets local development safely disable an incomplete optional value.
const requireFromHere = createRequire(__filename);
const { v2: cloudinary } = requireFromHere('cloudinary') as { v2: typeof CloudinaryV2 };

export type CloudinaryImage = {
  publicId: string;
  version: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

export type CloudinaryPublicAsset = CloudinaryImage & {
  resourceType: 'image' | 'video';
};

export const isCloudinaryEnabled = (): boolean => isCompleteCloudinaryUrl(env.CLOUDINARY_URL);

let cloudinaryConfigured = false;
const ensureCloudinary = (): void => {
  if (!isCloudinaryEnabled()) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_URL to the complete cloudinary://API_KEY:API_SECRET@CLOUD_NAME value.',
    );
  }
  if (!cloudinaryConfigured) {
    const parsed = new URL(env.CLOUDINARY_URL);
    cloudinary.config({
      cloud_name: decodeURIComponent(parsed.hostname),
      api_key: decodeURIComponent(parsed.username),
      api_secret: decodeURIComponent(parsed.password),
      secure: true,
    });
    cloudinaryConfigured = true;
  }
};

export const storePrivateCloudinaryImage = async (
  image: DownloadedImage,
  publicId: string,
): Promise<CloudinaryImage> => {
  ensureCloudinary();
  const storageRoot = env.CLOUDINARY_FOLDER.replace(/^\/+|\/+$/g, '');
  const resolvedPublicId = `${storageRoot}/${publicId.replace(/^\/+/, '')}`;
  const assetFolder = resolvedPublicId.split('/').slice(0, -1).join('/');
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: resolvedPublicId,
        // New Cloudinary accounts use dynamic folders. A public_id path does not place an asset
        // in the corresponding Media Library folder in that mode, so set the physical folder too.
        // Legacy fixed-folder accounts safely ignore this option and continue using public_id.
        asset_folder: assetFolder,
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

export const storePublicCloudinaryImage = async (
  image: DownloadedImage,
  publicId: string,
): Promise<CloudinaryImage> => {
  const asset = await storePublicCloudinaryAsset(image, publicId, 'image');
  return asset;
};

export const storePublicCloudinaryAsset = async (
  asset: DownloadedImage,
  publicId: string,
  resourceType: 'image' | 'video',
): Promise<CloudinaryPublicAsset> => {
  ensureCloudinary();
  const storageRoot = env.CLOUDINARY_FOLDER.replace(/^\/+|\/+$/g, '');
  const resolvedPublicId = `${storageRoot}/${publicId.replace(/^\/+/, '')}`;
  const assetFolder = resolvedPublicId.split('/').slice(0, -1).join('/');
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: resolvedPublicId,
        asset_folder: assetFolder,
        resource_type: resourceType,
        type: 'upload',
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
    stream.end(asset.body);
  });

  return {
    publicId: result.public_id,
    version: result.version,
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    resourceType,
  };
};

export const createPublicCloudinaryUrl = (asset: {
  publicId: string;
  version?: number | null;
  format?: string | null;
}): string => {
  ensureCloudinary();
  return cloudinary.url(asset.publicId, {
    secure: true,
    resource_type: 'image',
    type: 'upload',
    quality: 'auto',
    fetch_format: 'auto',
    crop: 'limit',
    width: 1200,
    ...(asset.version === undefined || asset.version === null ? {} : { version: asset.version }),
    ...(asset.format === undefined || asset.format === null ? {} : { format: asset.format }),
  });
};

export const createPublicCloudinaryAssetUrl = (asset: {
  publicId: string;
  resourceType: 'image' | 'video';
  version?: number | null;
  format?: string | null;
}): string => {
  ensureCloudinary();
  return cloudinary.url(asset.publicId, {
    secure: true,
    resource_type: asset.resourceType,
    type: 'upload',
    ...(asset.resourceType === 'image'
      ? { quality: 'auto', fetch_format: 'auto', crop: 'limit', width: 1600 }
      : {}),
    ...(asset.version === undefined || asset.version === null ? {} : { version: asset.version }),
    ...(asset.format === undefined || asset.format === null ? {} : { format: asset.format }),
  });
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

export const deletePublicCloudinaryImage = async (publicId: string): Promise<void> => {
  await deletePublicCloudinaryAsset(publicId, 'image');
};

export const deletePublicCloudinaryAsset = async (
  publicId: string,
  resourceType: 'image' | 'video',
): Promise<void> => {
  if (!isCloudinaryEnabled()) return;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: 'upload',
    invalidate: true,
  });
};
