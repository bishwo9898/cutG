import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import type { Camera as VisionCamera } from 'react-native-vision-camera';
import { Camera as FaceCamera, type Face } from 'react-native-vision-camera-face-detector';

import { ApiError, mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { isHairScanYawReady } from '@/lib/hairStudio';
import type { HairScanAngle } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const { width, height } = Dimensions.get('window');
const ovalWidth = width * 0.7;
const ovalHeight = Math.min(height * 0.5, ovalWidth * 1.35);
const phases: Array<{ angle: HairScanAngle; title: string; subtitle: string }> = [
  { angle: 'FRONT', title: 'Look straight ahead', subtitle: 'Center your face in the oval' },
  { angle: 'LEFT', title: 'Slowly turn left', subtitle: 'Keep your eyes toward the screen' },
  { angle: 'RIGHT', title: 'Now turn right', subtitle: 'Last angle — hold steady' },
];

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');

export default function HairScanScreen(): React.ReactElement {
  const { scanId = '' } = useLocalSearchParams<{ scanId?: string }>();
  const camera = useRef<VisionCamera>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureLock = useRef(false);
  const phaseRef = useRef(0);
  const retryAngles = useRef<HairScanAngle[]>([]);
  const [phase, setPhase] = useState(0);
  const [qualityGood, setQualityGood] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);
  useEffect(
    (): (() => void) => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (countdownTimer.current !== null) clearTimeout(countdownTimer.current);
    },
    [],
  );

  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    if (countdownTimer.current !== null) clearTimeout(countdownTimer.current);
    holdTimer.current = null;
    countdownTimer.current = null;
    setCountdown(null);
    setQualityGood(false);
  }, []);

  const uploadCapture = async (uri: string, angle: HairScanAngle): Promise<void> => {
    const normalized = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.86,
      format: SaveFormat.JPEG,
    });
    const response = await fetch(normalized.uri);
    const bytes = await response.arrayBuffer();
    const checksum = toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
    const signed = await mobileApi.client.presignHairCapture(scanId, {
      angle,
      mimeType: 'image/jpeg',
      sizeBytes: bytes.byteLength,
      checksumSha256: checksum,
    });
    const uploaded = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: signed.headers,
      body: bytes,
    });
    if (!uploaded.ok) throw new Error('The private portrait upload failed.');
    await mobileApi.client.completeHairCapture(scanId, signed.captureId, {
      width: normalized.width,
      height: normalized.height,
    });
  };

  const capture = useCallback(async (): Promise<void> => {
    if (camera.current === null || captureLock.current || processing) return;
    captureLock.current = true;
    cancelHold();
    setProcessing(true);
    setError(null);
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      const currentPhase = phaseRef.current;
      const currentAngle = phases[currentPhase]?.angle ?? 'FRONT';
      await uploadCapture(`file://${photo.path}`, currentAngle);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (retryAngles.current.length > 0) {
        retryAngles.current = retryAngles.current.filter((angle) => angle !== currentAngle);
        const nextFailed = retryAngles.current[0];
        if (nextFailed !== undefined) {
          const next = phases.findIndex((item) => item.angle === nextFailed);
          phaseRef.current = next;
          setPhase(next);
          setQualityGood(false);
        } else {
          await mobileApi.client.validateHairScan(scanId, {});
          router.replace(`/(client)/design/style?scanId=${scanId}`);
        }
      } else if (currentPhase < phases.length - 1) {
        const next = currentPhase + 1;
        phaseRef.current = next;
        setPhase(next);
        setQualityGood(false);
      } else {
        await mobileApi.client.validateHairScan(scanId, {});
        router.replace(`/(client)/design/style?scanId=${scanId}`);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'HAIR_SCAN_REJECTED') {
        const rejectedFrames = caught.details?.rejectedFrames;
        if (Array.isArray(rejectedFrames)) {
          const failedAngles = rejectedFrames.flatMap((frame) =>
            typeof frame === 'object' &&
            frame !== null &&
            'angle' in frame &&
            phases.some((item) => item.angle === frame.angle)
              ? [frame.angle as HairScanAngle]
              : [],
          );
          const first = phases.find((item) => failedAngles.includes(item.angle));
          if (first !== undefined) {
            retryAngles.current = phases
              .map((item) => item.angle)
              .filter((angle) => failedAngles.includes(angle));
            const retryPhase = phases.findIndex((item) => item.angle === first.angle);
            phaseRef.current = retryPhase;
            setPhase(retryPhase);
          }
        }
      }
      setError(errorMessage(caught));
    } finally {
      captureLock.current = false;
      setProcessing(false);
    }
  }, [cancelHold, processing, scanId]);

  const handleFaces = useCallback(
    (faces: Face[]): void => {
      if (processing || captureLock.current) return;
      if (faces.length !== 1) {
        cancelHold();
        return;
      }
      const face = faces[0];
      if (face === undefined) return;
      const current = phases[phaseRef.current]?.angle ?? 'FRONT';
      const angleGood = isHairScanYawReady(current, face.yawAngle ?? 0);
      const area = (face.bounds.width * face.bounds.height) / (width * height);
      const framingGood = area >= 0.06 && area <= 0.55;
      const hairlineGood = face.bounds.y >= height * 0.035;
      const stable = Math.abs(face.rollAngle ?? 0) <= 14 && Math.abs(face.pitchAngle ?? 0) <= 20;
      if (!angleGood || !framingGood || !hairlineGood || !stable) {
        cancelHold();
        return;
      }
      setQualityGood(true);
      if (holdTimer.current !== null) return;
      setCountdown(2);
      countdownTimer.current = setTimeout(() => setCountdown(1), 750);
      holdTimer.current = setTimeout(() => void capture(), 1500);
    },
    [cancelHold, capture, processing],
  );

  const current = phases[phase] ?? phases[0];
  if (!hasPermission) {
    return (
      <View style={styles.permission}>
        <Text style={styles.title}>Camera permission is required</Text>
        <Text style={styles.subtitle}>cutG only captures the three still images you approve.</Text>
        <Pressable style={styles.action} onPress={() => void requestPermission()}>
          <Text style={styles.actionText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
    );
  }
  if (device === undefined) {
    return (
      <View style={styles.permission}>
        <Text style={styles.title}>No front camera found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FaceCamera
        ref={camera}
        device={device}
        isActive={!processing}
        photo
        style={StyleSheet.absoluteFill}
        faceDetectionCallback={handleFaces}
        faceDetectionOptions={{
          performanceMode: 'fast',
          landmarkMode: 'all',
          classificationMode: 'all',
          trackingEnabled: true,
          autoScale: true,
        }}
      />
      <View pointerEvents="none" style={styles.scrim}>
        <View style={[styles.oval, qualityGood && styles.ovalGood]} />
      </View>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.dots}>
        {phases.map((item, index) => (
          <View key={item.angle} style={[styles.dot, index <= phase && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.instructions}>
        {current?.angle !== 'FRONT' ? (
          <Text style={styles.arrow}>{current?.angle === 'LEFT' ? '←' : '→'}</Text>
        ) : null}
        <Text style={styles.title}>{processing ? 'Securing capture…' : current?.title}</Text>
        <Text style={styles.subtitle}>
          {countdown !== null ? `Hold still · ${countdown}` : current?.subtitle}
        </Text>
        <View style={styles.qualityTrack}>
          <View style={[styles.qualityFill, { width: qualityGood ? '100%' : '28%' }]} />
        </View>
        {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        {error !== null ? (
          <Pressable style={styles.retry} onPress={() => setError(null)}>
            <Text style={styles.actionText}>Try this angle again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  actionText: { ...typography.button, color: colors.textOnAccent },
  arrow: { color: '#fff', fontSize: 42 },
  cancel: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  close: { left: spacing.lg, padding: spacing.sm, position: 'absolute', top: 54 },
  closeText: { color: '#fff', fontSize: 34 },
  dot: { backgroundColor: 'rgba(255,255,255,.25)', borderRadius: 4, height: 8, width: 24 },
  dotActive: { backgroundColor: colors.accentLight },
  dots: { flexDirection: 'row', gap: spacing.sm, position: 'absolute', right: spacing.lg, top: 70 },
  error: { ...typography.bodySmall, color: '#ff9a9a', textAlign: 'center' },
  instructions: {
    alignItems: 'center',
    bottom: 70,
    gap: spacing.sm,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
  },
  oval: {
    borderColor: 'rgba(255,255,255,.75)',
    borderRadius: ovalWidth / 2,
    borderWidth: 3,
    height: ovalHeight,
    width: ovalWidth,
  },
  ovalGood: {
    borderColor: colors.success,
    shadowColor: colors.success,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  permission: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  qualityFill: { backgroundColor: colors.success, borderRadius: 2, height: 4 },
  qualityTrack: {
    backgroundColor: 'rgba(255,255,255,.22)',
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  retry: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  root: { backgroundColor: '#000', flex: 1 },
  scrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.25)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  subtitle: { ...typography.body, color: 'rgba(255,255,255,.78)', textAlign: 'center' },
  title: { ...typography.h2, color: '#fff', textAlign: 'center' },
});
