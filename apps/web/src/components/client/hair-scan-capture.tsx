'use client';

import { Camera, Check, RefreshCw, ShieldCheck, VideoOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HairCaptureQuality, HairScanAngle } from '@/lib/contracts';
import { assessPixels, requiredPose } from '@/lib/hair-capture';

const ANGLES: HairScanAngle[] = ['FRONT', 'LEFT', 'RIGHT'];
const ANGLE_COPY: Record<HairScanAngle, { title: string; instruction: string }> = {
  FRONT: { title: 'Front', instruction: 'Look straight into the camera' },
  LEFT: { title: 'Left angle', instruction: 'Slowly turn about 30 degrees left' },
  RIGHT: { title: 'Right angle', instruction: 'Slowly turn about 30 degrees right' },
};

export type CapturedHairImage = {
  angle: HairScanAngle;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  quality: HairCaptureQuality;
};

type PoseResult = {
  faceCount: number;
  yaw: number;
  centered: boolean;
  hairlineVisible: boolean;
  poseScore: number;
};

type Props = {
  busy?: boolean;
  failedAngle?: HairScanAngle | null;
  onComplete: (captures: CapturedHairImage[]) => void;
};

const canvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('Camera capture failed.')) : resolve(blob)),
      'image/jpeg',
      0.86,
    );
  });

export function HairScanCapture({
  busy = false,
  failedAngle = null,
  onComplete,
}: Props): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureLock = useRef(false);
  const stableSince = useRef<number | null>(null);
  const currentAngleRef = useRef<HairScanAngle>('FRONT');
  const capturesRef = useRef<Partial<Record<HairScanAngle, CapturedHairImage>>>({});
  const [cameraState, setCameraState] = useState<'starting' | 'ready' | 'denied'>('starting');
  const [poseEngine, setPoseEngine] = useState<'loading' | 'ready' | 'manual'>('loading');
  const [currentAngle, setCurrentAngle] = useState<HairScanAngle>('FRONT');
  const [pose, setPose] = useState<PoseResult>({
    faceCount: 0,
    yaw: 0,
    centered: false,
    hairlineVisible: false,
    poseScore: 0,
  });
  const [captures, setCaptures] = useState<Partial<Record<HairScanAngle, CapturedHairImage>>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    currentAngleRef.current = currentAngle;
    stableSince.current = null;
  }, [currentAngle]);

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(
    () => (): void => {
      Object.values(capturesRef.current).forEach((capture) => {
        if (capture !== undefined) URL.revokeObjectURL(capture.previewUrl);
      });
    },
    [],
  );

  useEffect(() => {
    if (failedAngle === null) return;
    setCaptures((previous) => {
      const failed = previous[failedAngle];
      if (failed !== undefined) URL.revokeObjectURL(failed.previewUrl);
      return { ...previous, [failedAngle]: undefined };
    });
    setCurrentAngle(failedAngle);
    setNotice(`Retake the ${ANGLE_COPY[failedAngle].title.toLowerCase()} photo.`);
  }, [failedAngle]);

  const takeCapture = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (video === null || video.videoWidth === 0 || captureLock.current || busy) return;
    captureLock.current = true;
    try {
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(320, Math.round(video.videoWidth * scale));
      const height = Math.max(320, Math.round(video.videoHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) throw new Error('Camera canvas was unavailable.');
      context.drawImage(video, 0, 0, width, height);
      const quality = assessPixels(context.getImageData(0, 0, width, height).data);
      if (!quality.accepted) {
        setNotice(quality.reason);
        stableSince.current = null;
        return;
      }
      const angle = currentAngleRef.current;
      const blob = await canvasBlob(canvas);
      const captured: CapturedHairImage = {
        angle,
        blob,
        previewUrl: URL.createObjectURL(blob),
        width,
        height,
        quality: {
          brightness: quality.brightness,
          sharpness: quality.sharpness,
          poseScore: pose.poseScore || 0.75,
        },
      };
      setCaptures((previous) => {
        const old = previous[angle];
        if (old !== undefined) URL.revokeObjectURL(old.previewUrl);
        return { ...previous, [angle]: captured };
      });
      setNotice(`${ANGLE_COPY[angle].title} captured.`);
      const next = ANGLES.find(
        (candidate) => captures[candidate] === undefined && candidate !== angle,
      );
      if (next !== undefined) setCurrentAngle(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Camera capture failed.');
    } finally {
      captureLock.current = false;
    }
  }, [busy, captures, pose.poseScore]);

  useEffect(() => {
    let stopped = false;
    const startCamera = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current !== null) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('ready');
      } catch {
        setCameraState('denied');
      }
    };
    void startCamera();
    return (): void => {
      stopped = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (cameraState !== 'ready') return;
    const worker = new Worker(new URL('../../workers/face-landmarker.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.postMessage({
      kind: 'init',
      modelUrl:
        process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL_URL ??
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    });
    worker.onmessage = (event: MessageEvent<Record<string, unknown>>): void => {
      if (event.data.kind === 'ready') setPoseEngine('ready');
      if (event.data.kind === 'unavailable') setPoseEngine('manual');
      if (event.data.kind === 'result') {
        setPose({
          faceCount: Number(event.data.faceCount),
          yaw: Number(event.data.yaw),
          centered: Boolean(event.data.centered),
          hairlineVisible: Boolean(event.data.hairlineVisible),
          poseScore: Number(event.data.poseScore),
        });
      }
    };
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (video === null || video.readyState < 2) return;
      void createImageBitmap(video).then((bitmap) =>
        worker.postMessage({ kind: 'frame', bitmap, timestamp: performance.now() }, [bitmap]),
      );
    }, 260);
    return (): void => {
      window.clearInterval(interval);
      worker.terminate();
    };
  }, [cameraState]);

  const poseReady =
    pose.faceCount === 1 &&
    pose.centered &&
    pose.hairlineVisible &&
    requiredPose(currentAngle, pose.yaw);
  useEffect(() => {
    if (
      poseEngine !== 'ready' ||
      cameraState !== 'ready' ||
      busy ||
      captures[currentAngle] !== undefined
    )
      return;
    if (!poseReady) {
      stableSince.current = null;
      return;
    }
    stableSince.current ??= Date.now();
    if (Date.now() - stableSince.current >= 900) {
      stableSince.current = null;
      void takeCapture();
    }
  }, [busy, cameraState, captures, currentAngle, pose, poseEngine, poseReady, takeCapture]);

  const capturedValues = ANGLES.flatMap((angle) => {
    const capture = captures[angle];
    return capture === undefined ? [] : [capture];
  });

  if (cameraState === 'denied') {
    return (
      <section className="hair-camera-unavailable">
        <VideoOff size={34} />
        <h2>Camera access is needed</h2>
        <p>
          Allow camera access in your browser settings, then reload this page. Video and rejected
          frames are never uploaded.
        </p>
      </section>
    );
  }

  return (
    <section className="hair-camera-stage" aria-label="Three-angle hair scan">
      <div className="hair-camera-topbar">
        <div>
          <span className="hair-scan-kicker">Private three-angle scan</span>
          <h2>{ANGLE_COPY[currentAngle].instruction}</h2>
        </div>
        <span className="hair-camera-privacy">
          <ShieldCheck size={15} /> Stills only
        </span>
      </div>
      <div className="hair-camera-viewport">
        <video aria-label="Live camera preview" muted playsInline ref={videoRef} />
        <div className={`hair-face-guide ${poseReady ? 'is-ready' : ''}`} aria-hidden="true" />
        <div className="hair-pose-status" role="status">
          {cameraState === 'starting'
            ? 'Starting camera...'
            : poseEngine === 'loading'
              ? 'Preparing face guidance...'
              : poseEngine === 'manual'
                ? 'Center your face, keep your hairline visible, then capture'
                : pose.faceCount !== 1
                  ? 'Keep one face in frame'
                  : !pose.hairlineVisible
                    ? 'Move down so your hairline is visible'
                    : !pose.centered
                      ? 'Move your face into the guide'
                      : poseReady
                        ? 'Hold still'
                        : ANGLE_COPY[currentAngle].instruction}
        </div>
      </div>
      <div className="hair-angle-progress">
        {ANGLES.map((angle) => (
          <button
            className={currentAngle === angle ? 'is-current' : ''}
            disabled={busy}
            key={angle}
            onClick={() => setCurrentAngle(angle)}
            type="button"
          >
            <span>
              {captures[angle] === undefined ? ANGLES.indexOf(angle) + 1 : <Check size={13} />}
            </span>
            {ANGLE_COPY[angle].title}
          </button>
        ))}
      </div>
      <div className="hair-capture-actions">
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => void takeCapture()}
          type="button"
        >
          <Camera size={17} /> Capture now
        </button>
        {captures[currentAngle] !== undefined && (
          <button
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              const capture = captures[currentAngle];
              if (capture !== undefined) URL.revokeObjectURL(capture.previewUrl);
              setCaptures((previous) => ({ ...previous, [currentAngle]: undefined }));
            }}
            type="button"
          >
            <RefreshCw size={16} /> Retake
          </button>
        )}
        <button
          className="button button-primary"
          disabled={capturedValues.length !== 3 || busy}
          onClick={() => onComplete(capturedValues)}
          type="button"
        >
          {busy ? 'Validating photos...' : 'Continue with these photos'}
        </button>
      </div>
      {notice !== null && <p className="hair-camera-notice">{notice}</p>}
    </section>
  );
}
