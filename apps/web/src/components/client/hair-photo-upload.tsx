'use client';

import type { FaceDetector, FaceDetectorResult } from '@mediapipe/tasks-vision';
import {
  Check,
  CircleAlert,
  ImageUp,
  LoaderCircle,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HairScanAngle } from '@/lib/contracts';

const VISION_WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const SCAN_SEQUENCE: Array<{ angle: HairScanAngle; label: string; shortLabel: string }> = [
  { angle: 'FRONT', label: 'Look straight ahead', shortLabel: 'Front' },
  { angle: 'LEFT', label: 'Turn to your left', shortLabel: 'Left' },
  { angle: 'RIGHT', label: 'Turn to your right', shortLabel: 'Right' },
];
const STABLE_CAPTURE_MS = 850;

type MimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];
type StudioMode = 'choose' | 'scan' | 'review';
type DetectorStatus = 'idle' | 'loading' | 'ready' | 'fallback';
type ReviewSource = 'scan' | 'upload';

export type CaptureQuality = {
  brightness: number;
  sharpness: number;
  faceCount: number;
  poseScore: number;
};

export type UploadedHairImage = {
  angle: HairScanAngle;
  blob: Blob;
  mimeType: MimeType;
  previewUrl: string;
  width: number;
  height: number;
  quality?: Partial<CaptureQuality>;
};

export type HairPhotoSelection = {
  captures: UploadedHairImage[];
  source: ReviewSource;
};

type Props = {
  busy?: boolean;
  maxBytes?: number;
  onComplete: (selection: HairPhotoSelection) => void;
};

type PixelQuality = {
  brightness: number;
  sharpness: number;
};

type FrameAssessment = CaptureQuality & {
  yaw: number;
  ready: boolean;
  message: string;
};

type RejectedUpload = {
  previewUrl: string;
  issues: string[];
};

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const loadImage = async (
  url: string,
): Promise<{ image: HTMLImageElement; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = (): void => {
      resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = (): void => {
      reject(new Error('Choose a readable JPEG, PNG, or WebP image.'));
    };
    image.src = url;
  });

const samplePixels = (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): PixelQuality => {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return { brightness: 128, sharpness: 20 };
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let brightnessTotal = 0;
  let edgeTotal = 0;
  let edgeSamples = 0;
  const previousRow = new Float32Array(canvas.width);

  for (let y = 0; y < canvas.height; y += 1) {
    let previous = 0;
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const luminance =
        (pixels[offset] ?? 0) * 0.299 +
        (pixels[offset + 1] ?? 0) * 0.587 +
        (pixels[offset + 2] ?? 0) * 0.114;
      brightnessTotal += luminance;
      if (x > 0) {
        edgeTotal += Math.abs(luminance - previous);
        edgeSamples += 1;
      }
      if (y > 0) {
        edgeTotal += Math.abs(luminance - (previousRow[x] ?? luminance));
        edgeSamples += 1;
      }
      previous = luminance;
      previousRow[x] = luminance;
    }
  }

  return {
    brightness: brightnessTotal / (canvas.width * canvas.height),
    sharpness: edgeSamples === 0 ? 0 : edgeTotal / edgeSamples,
  };
};

const createFaceDetector = async (runningMode: 'IMAGE' | 'VIDEO'): Promise<FaceDetector> => {
  const { FaceDetector: Detector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_ROOT);
  return Detector.createFromOptions(vision, {
    baseOptions: {
      delegate: 'CPU',
      modelAssetPath: FACE_MODEL_URL,
    },
    minDetectionConfidence: 0.58,
    minSuppressionThreshold: 0.3,
    runningMode,
  });
};

const yawFromDetection = (result: FaceDetectorResult): number => {
  const keypoints = result.detections[0]?.keypoints ?? [];
  const leftEye = keypoints[0];
  const rightEye = keypoints[1];
  const nose = keypoints[2];
  if (leftEye === undefined || rightEye === undefined || nose === undefined) return 0;
  const eyeDistance = Math.max(0.01, Math.abs(rightEye.x - leftEye.x));
  return (nose.x - (leftEye.x + rightEye.x) / 2) / eyeDistance;
};

const assessFrame = (
  result: FaceDetectorResult,
  pixels: PixelQuality,
  width: number,
  height: number,
  target: HairScanAngle,
): FrameAssessment => {
  const faceCount = result.detections.length;
  const detection = result.detections[0];
  const yaw = yawFromDetection(result);
  const base = {
    brightness: Math.round(pixels.brightness * 10) / 10,
    faceCount,
    sharpness: Math.round(pixels.sharpness * 10) / 10,
    yaw,
  };

  if (faceCount === 0 || detection?.boundingBox === undefined) {
    return { ...base, poseScore: 0, ready: false, message: 'Move your face into the oval' };
  }
  if (faceCount > 1) {
    return { ...base, poseScore: 0, ready: false, message: 'Only one person should be in frame' };
  }
  if (pixels.brightness < 48) {
    return { ...base, poseScore: 0, ready: false, message: 'Move toward a soft light' };
  }
  if (pixels.brightness > 225) {
    return { ...base, poseScore: 0, ready: false, message: 'Step away from the brightest light' };
  }
  if (pixels.sharpness < 5.5) {
    return { ...base, poseScore: 0, ready: false, message: 'Hold still for a sharper photo' };
  }

  const box = detection.boundingBox;
  const faceWidth = box.width / width;
  const faceHeight = box.height / height;
  const centerX = (box.originX + box.width / 2) / width;
  const centerY = (box.originY + box.height / 2) / height;
  if (faceHeight < 0.26 || faceWidth < 0.17) {
    return { ...base, poseScore: 0.2, ready: false, message: 'Come a little closer' };
  }
  if (faceHeight > 0.72 || faceWidth > 0.66) {
    return { ...base, poseScore: 0.2, ready: false, message: 'Move back slightly' };
  }
  if (Math.abs(centerX - 0.5) > 0.16 || Math.abs(centerY - 0.48) > 0.19) {
    return { ...base, poseScore: 0.35, ready: false, message: 'Center your face in the oval' };
  }

  if (target === 'FRONT') {
    const poseScore = clamp(1 - Math.abs(yaw) * 2.5);
    if (yaw > 0.16) {
      return { ...base, poseScore, ready: false, message: 'Turn slightly to your right' };
    }
    if (yaw < -0.16) {
      return { ...base, poseScore, ready: false, message: 'Turn slightly to your left' };
    }
    return { ...base, poseScore, ready: true, message: 'Perfect — hold still' };
  }

  if (target === 'LEFT') {
    const poseScore = clamp(1 - Math.abs(yaw - 0.34) * 2);
    if (yaw < 0.22) {
      return { ...base, poseScore, ready: false, message: 'Turn slowly to your left' };
    }
    if (yaw > 0.62) {
      return { ...base, poseScore, ready: false, message: 'Turn slightly back toward the camera' };
    }
    return { ...base, poseScore, ready: true, message: 'Great angle — hold still' };
  }

  const poseScore = clamp(1 - Math.abs(yaw + 0.34) * 2);
  if (yaw > -0.22) {
    return { ...base, poseScore, ready: false, message: 'Turn slowly to your right' };
  }
  if (yaw < -0.62) {
    return { ...base, poseScore, ready: false, message: 'Turn slightly back toward the camera' };
  }
  return { ...base, poseScore, ready: true, message: 'Great angle — hold still' };
};

const fallbackAssessment = (pixels: PixelQuality): FrameAssessment => {
  if (pixels.brightness < 48) {
    return {
      ...pixels,
      faceCount: 1,
      poseScore: 0.5,
      yaw: 0,
      ready: false,
      message: 'Move toward a soft light',
    };
  }
  if (pixels.brightness > 225) {
    return {
      ...pixels,
      faceCount: 1,
      poseScore: 0.5,
      yaw: 0,
      ready: false,
      message: 'Step away from the brightest light',
    };
  }
  if (pixels.sharpness < 5.5) {
    return {
      ...pixels,
      faceCount: 1,
      poseScore: 0.5,
      yaw: 0,
      ready: false,
      message: 'Hold still for a sharper photo',
    };
  }
  return {
    ...pixels,
    faceCount: 1,
    poseScore: 0.5,
    yaw: 0,
    ready: true,
    message: 'Center your face and hold still',
  };
};

const cameraCapture = async (
  video: HTMLVideoElement,
  angle: HairScanAngle,
  quality: FrameAssessment,
): Promise<UploadedHairImage> => {
  if (video.videoWidth < 200 || video.videoHeight < 200) {
    throw new Error('The camera is still starting. Wait a moment and try again.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('The camera frame could not be captured.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value === null
          ? reject(new Error('The camera frame could not be captured.'))
          : resolve(value),
      'image/jpeg',
      0.9,
    );
  });
  return {
    angle,
    blob,
    height: canvas.height,
    mimeType: 'image/jpeg',
    previewUrl: URL.createObjectURL(blob),
    quality: {
      brightness: quality.brightness,
      faceCount: quality.faceCount,
      poseScore: quality.poseScore,
      sharpness: quality.sharpness,
    },
    width: canvas.width,
  };
};

const uploadIssues = (
  result: FaceDetectorResult | null,
  pixels: PixelQuality,
  width: number,
  height: number,
): string[] => {
  const issues: string[] = [];
  if (width < 600 || height < 600) issues.push('Choose a photo at least 600 × 600 pixels.');
  if (pixels.brightness < 48) issues.push('The photo is too dark. Face a window or soft light.');
  if (pixels.brightness > 225)
    issues.push('The photo is overexposed. Move away from direct light.');
  if (pixels.sharpness < 5.5) issues.push('The photo looks blurry. Use a sharper, steady image.');
  if (result === null) return issues;
  if (result.detections.length === 0) issues.push('We could not find a clear face in this photo.');
  if (result.detections.length > 1) issues.push('Choose a photo with only one person.');

  const box = result.detections[0]?.boundingBox;
  if (result.detections.length === 1 && box !== undefined) {
    const centerX = (box.originX + box.width / 2) / width;
    const centerY = (box.originY + box.height / 2) / height;
    const faceHeight = box.height / height;
    if (faceHeight < 0.22) issues.push('Your face is too far away. Choose a closer portrait.');
    if (faceHeight > 0.78) issues.push('Your face is cropped too tightly. Include your full hair.');
    if (Math.abs(centerX - 0.5) > 0.2 || Math.abs(centerY - 0.48) > 0.22) {
      issues.push('Center your face and keep your full head inside the photo.');
    }
    if (Math.abs(yawFromDetection(result)) > 0.22) {
      issues.push('Use a front-facing photo with your eyes looking toward the camera.');
    }
  }
  return issues;
};

export function HairPhotoUpload({
  busy = false,
  maxBytes = 4_000_000,
  onComplete,
}: Props): React.ReactElement {
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoDetectorRef = useRef<FaceDetector | null>(null);
  const imageDetectorRef = useRef<FaceDetector | null>(null);
  const capturesRef = useRef<UploadedHairImage[]>([]);
  const rejectedPreviewRef = useRef<string | null>(null);
  const captureInFlightRef = useRef(false);
  const [mode, setMode] = useState<StudioMode>('choose');
  const [captures, setCaptures] = useState<UploadedHairImage[]>([]);
  const [reviewSource, setReviewSource] = useState<ReviewSource>('scan');
  const [stepIndex, setStepIndex] = useState(0);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [detectorStatus, setDetectorStatus] = useState<DetectorStatus>('idle');
  const [checkingUpload, setCheckingUpload] = useState(false);
  const [assessment, setAssessment] = useState<FrameAssessment | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejectedUpload, setRejectedUpload] = useState<RejectedUpload | null>(null);

  const releaseCaptures = useCallback((): void => {
    capturesRef.current.forEach((capture) => URL.revokeObjectURL(capture.previewUrl));
    capturesRef.current = [];
    setCaptures([]);
  }, []);

  const clearRejectedUpload = useCallback((): void => {
    if (rejectedPreviewRef.current !== null) {
      URL.revokeObjectURL(rejectedPreviewRef.current);
      rejectedPreviewRef.current = null;
    }
    setRejectedUpload(null);
  }, []);

  useEffect(
    () => (): void => {
      capturesRef.current.forEach((capture) => URL.revokeObjectURL(capture.previewUrl));
      if (rejectedPreviewRef.current !== null) {
        URL.revokeObjectURL(rejectedPreviewRef.current);
      }
      videoDetectorRef.current?.close();
      imageDetectorRef.current?.close();
    },
    [],
  );

  useEffect(() => {
    if (mode !== 'scan') return;
    let cancelled = false;
    let activeStream: MediaStream | undefined;
    setCameraStarting(true);
    setError(null);
    void navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          frameRate: { ideal: 60, min: 24 },
          height: { ideal: 1080 },
          width: { ideal: 1440 },
        },
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current !== null) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Camera access was unavailable. Allow permission or upload a photo instead.');
          setMode('choose');
        }
      })
      .finally(() => {
        if (!cancelled) setCameraStarting(false);
      });
    return (): void => {
      cancelled = true;
      activeStream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current !== null) videoRef.current.srcObject = null;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'scan' || videoDetectorRef.current !== null) return;
    let cancelled = false;
    setDetectorStatus('loading');
    void createFaceDetector('VIDEO')
      .then((detector) => {
        if (cancelled) {
          detector.close();
          return;
        }
        videoDetectorRef.current = detector;
        setDetectorStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setDetectorStatus('fallback');
      });
    return (): void => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'scan' || cameraStarting) return;
    let animationFrame = 0;
    let lastAnalysisAt = 0;
    let goodSince: number | null = null;
    let cancelled = false;
    captureInFlightRef.current = false;
    const target = SCAN_SEQUENCE[stepIndex]?.angle ?? 'FRONT';

    const analyze = (now: number): void => {
      if (cancelled) return;
      const video = videoRef.current;
      if (
        video === null ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0
      ) {
        animationFrame = requestAnimationFrame(analyze);
        return;
      }
      if (now - lastAnalysisAt < 80) {
        animationFrame = requestAnimationFrame(analyze);
        return;
      }
      lastAnalysisAt = now;

      try {
        const pixels = samplePixels(video, video.videoWidth, video.videoHeight);
        let nextAssessment: FrameAssessment;
        if (videoDetectorRef.current !== null && detectorStatus === 'ready') {
          const detection = videoDetectorRef.current.detectForVideo(video, now);
          nextAssessment = assessFrame(
            detection,
            pixels,
            video.videoWidth,
            video.videoHeight,
            target,
          );
        } else if (detectorStatus === 'fallback') {
          nextAssessment = fallbackAssessment(pixels);
        } else {
          nextAssessment = {
            ...pixels,
            faceCount: 0,
            message: 'Preparing smart face guidance…',
            poseScore: 0,
            ready: false,
            yaw: 0,
          };
        }
        setAssessment(nextAssessment);

        if (!nextAssessment.ready) {
          goodSince = null;
          setProgress(0);
        } else {
          goodSince ??= now;
          const nextProgress = clamp((now - goodSince) / STABLE_CAPTURE_MS) * 100;
          setProgress(nextProgress);
          if (nextProgress >= 100 && !captureInFlightRef.current) {
            captureInFlightRef.current = true;
            void cameraCapture(video, target, nextAssessment)
              .then((capture) => {
                if (cancelled) {
                  URL.revokeObjectURL(capture.previewUrl);
                  return;
                }
                const nextCaptures = [...capturesRef.current, capture];
                capturesRef.current = nextCaptures;
                setCaptures(nextCaptures);
                setProgress(0);
                setAssessment(null);
                if (stepIndex >= SCAN_SEQUENCE.length - 1) {
                  setReviewSource('scan');
                  setMode('review');
                } else {
                  setStepIndex((current) => current + 1);
                }
              })
              .catch((caught) => {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : 'The camera frame could not be captured.',
                );
                captureInFlightRef.current = false;
              });
          }
        }
      } catch {
        setDetectorStatus('fallback');
      }
      animationFrame = requestAnimationFrame(analyze);
    };

    animationFrame = requestAnimationFrame(analyze);
    return (): void => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [cameraStarting, detectorStatus, mode, stepIndex]);

  const chooseFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    setError(null);
    clearRejectedUpload();
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as MimeType)) {
      setError('Choose a JPEG, PNG, or WebP headshot.');
      return;
    }
    if (file.size < 10_000 || file.size > maxBytes) {
      setError(`Choose an image between 10 KB and ${Math.floor(maxBytes / 1_000_000)} MB.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCheckingUpload(true);
    try {
      const loaded = await loadImage(previewUrl);
      const pixels = samplePixels(loaded.image, loaded.width, loaded.height);
      let detection: FaceDetectorResult | null = null;
      try {
        imageDetectorRef.current ??= await createFaceDetector('IMAGE');
        detection = imageDetectorRef.current.detect(loaded.image);
      } catch {
        // Pixel quality checks still provide a useful fallback if the detector cannot load.
      }
      const issues = uploadIssues(detection, pixels, loaded.width, loaded.height);
      if (issues.length > 0) {
        rejectedPreviewRef.current = previewUrl;
        setRejectedUpload({ issues, previewUrl });
        return;
      }

      releaseCaptures();
      const capture: UploadedHairImage = {
        angle: 'FRONT',
        blob: file,
        height: loaded.height,
        mimeType: file.type as MimeType,
        previewUrl,
        quality: {
          brightness: pixels.brightness,
          sharpness: pixels.sharpness,
          ...(detection === null
            ? {}
            : {
                faceCount: detection.detections.length,
                poseScore: clamp(1 - Math.abs(yawFromDetection(detection))),
              }),
        },
        width: loaded.width,
      };
      capturesRef.current = [capture];
      setCaptures([capture]);
      setReviewSource('upload');
      setMode('review');
    } catch (caught) {
      URL.revokeObjectURL(previewUrl);
      setError(caught instanceof Error ? caught.message : 'The selected image could not be read.');
    } finally {
      setCheckingUpload(false);
    }
  };

  const startScan = (): void => {
    setError(null);
    clearRejectedUpload();
    releaseCaptures();
    setStepIndex(0);
    setProgress(0);
    setAssessment(null);
    if (navigator.mediaDevices?.getUserMedia === undefined) {
      nativeCameraInputRef.current?.click();
      return;
    }
    setMode('scan');
  };

  const chooseUpload = (): void => {
    setError(null);
    libraryInputRef.current?.click();
  };

  const inputs = (
    <>
      <input
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.target.value = '';
        }}
        ref={libraryInputRef}
        type="file"
      />
      <input
        accept="image/*"
        capture="user"
        hidden
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.target.value = '';
        }}
        ref={nativeCameraInputRef}
        type="file"
      />
    </>
  );

  if (mode === 'scan') {
    const currentStep = SCAN_SEQUENCE[stepIndex] ?? {
      angle: 'FRONT',
      label: 'Look straight ahead',
      shortLabel: 'Front',
    };
    const guidance = cameraStarting
      ? 'Starting camera…'
      : (assessment?.message ?? 'Preparing smart face guidance…');
    return (
      <section className="hair-scan-stage">
        <div className="hair-scan-heading">
          <div>
            <p className="eyebrow">Quick face scan</p>
            <h2>{currentStep.label}</h2>
          </div>
          <button
            aria-label="Close face scan"
            className="hair-scan-close"
            disabled={busy}
            onClick={() => setMode('choose')}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="hair-scan-layout">
          <div className="hair-scan-view">
            <video aria-label="Live camera preview" autoPlay muted playsInline ref={videoRef} />
            <div className="hair-scan-shade" />
            <div className="hair-oval-guide">
              <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 128">
                <ellipse
                  className="hair-oval-track"
                  cx="50"
                  cy="64"
                  pathLength="100"
                  rx="47"
                  ry="61"
                />
                <ellipse
                  className="hair-oval-progress"
                  cx="50"
                  cy="64"
                  pathLength="100"
                  rx="47"
                  ry="61"
                  style={{ strokeDashoffset: 100 - progress }}
                />
              </svg>
            </div>
            <div
              aria-label="Automatic capture progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(progress)}
              className={`hair-live-guidance ${assessment?.ready === true ? 'is-ready' : ''}`}
              role="progressbar"
            >
              {assessment?.ready === true ? <Check size={17} /> : <ScanFace size={17} />}
              <span>{guidance}</span>
            </div>
            {cameraStarting && (
              <div className="hair-camera-loading">
                <LoaderCircle className="spin" size={25} />
              </div>
            )}
          </div>

          <aside className="hair-scan-sidebar">
            <span className="hair-scan-time">
              <Sparkles size={14} /> About 10 seconds
            </span>
            <h3>Three quick angles</h3>
            <p>
              Keep your hair inside the oval. We capture automatically as soon as the lighting,
              framing, and angle are clear.
            </p>
            <ol className="hair-scan-steps">
              {SCAN_SEQUENCE.map((step, index) => {
                const complete =
                  index < stepIndex || captures.some((item) => item.angle === step.angle);
                return (
                  <li
                    className={
                      complete ? 'is-complete' : index === stepIndex ? 'is-current' : undefined
                    }
                    key={step.angle}
                  >
                    <span>{complete ? <Check size={13} /> : index + 1}</span>
                    <div>
                      <strong>{step.shortLabel}</strong>
                      <small>
                        {complete ? 'Captured' : index === stepIndex ? guidance : 'Up next'}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="hair-scan-privacy">
              <ShieldCheck size={15} />
              Side views add scan context only. They are not sent to the AI yet.
            </p>
            {detectorStatus === 'fallback' && (
              <p className="hair-detector-note">
                Smart pose guidance could not load. Use the oval carefully, or upload a photo.
              </p>
            )}
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={chooseUpload}
              type="button"
            >
              <ImageUp size={16} /> Upload instead
            </button>
          </aside>
        </div>
        {error !== null && <p className="error-text">{error}</p>}
        {inputs}
      </section>
    );
  }

  if (mode === 'review') {
    const frontCapture = captures.find((capture) => capture.angle === 'FRONT') ?? captures[0];
    return (
      <section className="hair-photo-review hair-scan-review">
        <div className="hair-photo-frame hair-original-preview">
          {frontCapture !== undefined && (
            <Image
              alt="Original front portrait"
              fill
              sizes="460px"
              src={frontCapture.previewUrl}
              unoptimized
            />
          )}
          <span>Original photo</span>
        </div>
        <div className="hair-review-copy">
          <p className="eyebrow">
            {reviewSource === 'scan' ? 'Face scan complete' : 'Photo ready'}
          </p>
          <h2>
            {reviewSource === 'scan' ? 'That was quick. Looks good.' : 'Ready to use this photo?'}
          </h2>
          <p>
            {reviewSource === 'scan'
              ? 'Your front portrait is the original used for the hairstyle preview. The side angles are saved only as scan context.'
              : 'Lighting, sharpness, face position, and alignment passed the on-device check.'}
          </p>
          {reviewSource === 'scan' && (
            <div className="hair-captured-summary" aria-label="Captured scan angles">
              {SCAN_SEQUENCE.map((step) => (
                <span key={step.angle}>
                  <Check size={13} /> {step.shortLabel}
                </span>
              ))}
            </div>
          )}
          <div className="button-row hair-review-actions">
            <button
              className="button button-primary"
              disabled={busy || captures.length === 0}
              onClick={() => onComplete({ captures, source: reviewSource })}
              type="button"
            >
              {busy ? 'Uploading and checking…' : 'Continue with this photo'}
            </button>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={startScan}
              type="button"
            >
              <RefreshCw size={16} /> {reviewSource === 'scan' ? 'Scan again' : 'Use face scan'}
            </button>
            <button
              className="button button-secondary"
              disabled={busy || checkingUpload}
              onClick={chooseUpload}
              type="button"
            >
              <ImageUp size={16} /> {reviewSource === 'scan' ? 'Upload my own' : 'Choose another'}
            </button>
          </div>
          {error !== null && <p className="error-text">{error}</p>}
        </div>
        {inputs}
      </section>
    );
  }

  return (
    <section className="hair-photo-review hair-capture-entry">
      <div className="hair-capture-options">
        <button
          className="hair-dropzone hair-scan-entry"
          disabled={busy}
          onClick={startScan}
          type="button"
        >
          <span className="hair-entry-icon">
            <ScanFace size={31} />
          </span>
          <strong>Take a photo with Face Scan</strong>
          <span>Guided front and side angles · automatic capture</span>
          <small>Fastest · about 10 seconds</small>
        </button>
        <button
          className="hair-dropzone hair-dropzone-secondary"
          disabled={busy || checkingUpload}
          onClick={chooseUpload}
          type="button"
        >
          {checkingUpload ? <LoaderCircle className="spin" size={28} /> : <ImageUp size={28} />}
          <strong>{checkingUpload ? 'Checking photo quality…' : 'Upload a photo'}</strong>
          <span>JPEG, PNG, or WebP · up to {Math.floor(maxBytes / 1_000_000)} MB</span>
        </button>
      </div>
      <div className="hair-capture-copy">
        <p className="eyebrow">Photo setup</p>
        <h2>Get a better preview with a clearer photo.</h2>
        <p>
          Face Scan guides you in real time and takes each photo automatically. Prefer an existing
          picture? We check its lighting, sharpness, framing, and alignment before upload.
        </p>
        <div className="hair-quality-list">
          <span>
            <Check size={14} /> Soft, even light
          </span>
          <span>
            <Check size={14} /> Full hair and face visible
          </span>
          <span>
            <Check size={14} /> One person, looking forward
          </span>
        </div>
        <p className="hair-capture-privacy">
          <ShieldCheck size={15} /> Quality checks happen on this device before the private upload.
        </p>
        {rejectedUpload !== null && (
          <div className="hair-upload-rejected" role="alert">
            <div className="hair-rejected-thumb">
              <Image
                alt="Photo that needs improvement"
                fill
                sizes="100px"
                src={rejectedUpload.previewUrl}
                unoptimized
              />
            </div>
            <div>
              <strong>
                <CircleAlert size={16} /> Please choose a better photo
              </strong>
              <ul>
                {rejectedUpload.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <button className="button button-secondary" onClick={chooseUpload} type="button">
                Choose a better photo
              </button>
            </div>
          </div>
        )}
        {error !== null && <p className="error-text">{error}</p>}
      </div>
      {inputs}
    </section>
  );
}
