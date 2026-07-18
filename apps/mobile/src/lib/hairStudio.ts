import type { HairGenerationStatus } from '@barber-saas/shared-types';

export const isHairGenerationActive = (status: HairGenerationStatus | null | undefined): boolean =>
  status === 'QUEUED' || status === 'PROCESSING';

export const optionalDesignReference = (designId: string | undefined): { designId?: string } =>
  designId === undefined || designId.length === 0 ? {} : { designId };

export const appendDesignId = (path: string, designId: string | undefined): string => {
  if (designId === undefined || designId.length === 0) return path;
  return `${path}${path.includes('?') ? '&' : '?'}designId=${encodeURIComponent(designId)}`;
};
