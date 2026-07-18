import type { HairGenerationStatus, HairScanAngle } from '@barber-saas/shared-types';

export const isHairScanYawReady = (angle: HairScanAngle, yaw: number): boolean => {
  if (angle === 'FRONT') return Math.abs(yaw) <= 12;
  if (angle === 'LEFT') return yaw >= -48 && yaw <= -12;
  return yaw >= 12 && yaw <= 48;
};

export const isHairGenerationActive = (status: HairGenerationStatus | null | undefined): boolean =>
  status === 'QUEUED' || status === 'PROCESSING';

export const optionalDesignReference = (designId: string | undefined): { designId?: string } =>
  designId === undefined || designId.length === 0 ? {} : { designId };

export const appendDesignId = (path: string, designId: string | undefined): string => {
  if (designId === undefined || designId.length === 0) return path;
  return `${path}${path.includes('?') ? '&' : '?'}designId=${encodeURIComponent(designId)}`;
};
