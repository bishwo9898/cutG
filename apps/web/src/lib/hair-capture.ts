import type { HairScanAngle } from './contracts';

export type LocalCaptureQuality = {
  brightness: number;
  sharpness: number;
  accepted: boolean;
  reason: string | null;
};

export const requiredPose = (angle: HairScanAngle, yaw: number): boolean => {
  if (angle === 'FRONT') return Math.abs(yaw) <= 0.09;
  if (angle === 'LEFT') return yaw <= -0.12;
  return yaw >= 0.12;
};

export const assessPixels = (pixels: Uint8ClampedArray): LocalCaptureQuality => {
  const luminance: number[] = [];
  for (let index = 0; index < pixels.length; index += 16) {
    luminance.push(
      Number(pixels[index] ?? 0) * 0.2126 +
        Number(pixels[index + 1] ?? 0) * 0.7152 +
        Number(pixels[index + 2] ?? 0) * 0.0722,
    );
  }
  const brightness =
    luminance.reduce((sum, value) => sum + value, 0) / Math.max(1, luminance.length);
  let difference = 0;
  for (let index = 1; index < luminance.length; index += 1) {
    difference += Math.abs(Number(luminance[index]) - Number(luminance[index - 1]));
  }
  const sharpness = difference / Math.max(1, luminance.length - 1);
  if (brightness < 42)
    return { brightness, sharpness, accepted: false, reason: 'Move to brighter, even lighting.' };
  if (brightness > 238)
    return {
      brightness,
      sharpness,
      accepted: false,
      reason: 'Reduce the light directly on your face.',
    };
  if (sharpness < 2.2)
    return {
      brightness,
      sharpness,
      accepted: false,
      reason: 'Hold still and clean the camera lens.',
    };
  return { brightness, sharpness, accepted: true, reason: null };
};
