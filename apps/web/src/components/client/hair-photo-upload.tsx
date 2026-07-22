'use client';

import { Camera, ImageUp, RefreshCw, ShieldCheck, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { HairScanAngle } from '@/lib/contracts';

export type UploadedHairImage = {
  angle: HairScanAngle;
  blob: Blob;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  previewUrl: string;
  width: number;
  height: number;
};

type Props = {
  busy?: boolean;
  maxBytes?: number;
  onComplete: (capture: UploadedHairImage) => void;
};

const dimensions = async (url: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = (): void => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = (): void => {
      reject(new Error('Choose a readable JPEG, PNG, or WebP image.'));
    };
    image.src = url;
  });

const cameraBlob = async (video: HTMLVideoElement): Promise<Blob> => {
  if (video.videoWidth < 200 || video.videoHeight < 200) {
    throw new Error('The camera is still starting. Wait a moment and try again.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('The camera frame could not be captured.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(new Error('The camera frame could not be captured.'));
        else resolve(blob);
      },
      'image/jpeg',
      0.9,
    );
  });
};

export function HairPhotoUpload({
  busy = false,
  maxBytes = 4_000_000,
  onComplete,
}: Props): React.ReactElement {
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capture, setCapture] = useState<UploadedHairImage | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => (): void => {
      if (capture !== null) URL.revokeObjectURL(capture.previewUrl);
    },
    [capture],
  );

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    let activeStream: MediaStream | undefined;
    setCameraStarting(true);
    setError(null);
    void navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1440 },
          height: { ideal: 1800 },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current !== null) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) {
          setError('Camera access was unavailable. Allow camera permission or upload a photo.');
          setCameraOpen(false);
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
  }, [cameraOpen]);

  const chooseFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP headshot.');
      return;
    }
    if (file.size < 10_000 || file.size > maxBytes) {
      setError(`Choose an image between 10 KB and ${Math.floor(maxBytes / 1_000_000)} MB.`);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    try {
      const size = await dimensions(previewUrl);
      if (size.width < 200 || size.height < 200) {
        throw new Error('Choose a headshot that is at least 200 × 200 pixels.');
      }
      if (capture !== null) URL.revokeObjectURL(capture.previewUrl);
      setCapture({
        angle: 'FRONT',
        blob: file,
        mimeType: file.type as UploadedHairImage['mimeType'],
        previewUrl,
        ...size,
      });
    } catch (caught) {
      URL.revokeObjectURL(previewUrl);
      setError(caught instanceof Error ? caught.message : 'The selected image could not be read.');
    }
  };

  const openCamera = (): void => {
    setError(null);
    if (navigator.mediaDevices?.getUserMedia === undefined) {
      nativeCameraInputRef.current?.click();
      return;
    }
    setCameraOpen(true);
  };

  const takePhoto = async (): Promise<void> => {
    if (videoRef.current === null) return;
    try {
      const blob = await cameraBlob(videoRef.current);
      const file = new File([blob], `cutg-headshot-${Date.now()}.jpg`, { type: 'image/jpeg' });
      await chooseFile(file);
      setCameraOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The camera frame could not be captured.',
      );
    }
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

  if (capture === null) {
    return (
      <section className="hair-photo-review">
        {cameraOpen ? (
          <div className="hair-camera-panel">
            <video aria-label="Live camera preview" autoPlay muted playsInline ref={videoRef} />
            <div className="hair-camera-controls">
              <button
                className="button button-primary"
                disabled={cameraStarting || busy}
                onClick={() => void takePhoto()}
                type="button"
              >
                <Camera size={17} /> {cameraStarting ? 'Starting camera…' : 'Take photo'}
              </button>
              <button
                aria-label="Close camera"
                className="button button-secondary"
                disabled={busy}
                onClick={() => setCameraOpen(false)}
                type="button"
              >
                <X size={17} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="hair-capture-options">
            <button className="hair-dropzone" disabled={busy} onClick={openCamera} type="button">
              <Camera size={38} />
              <strong>Take a photo</strong>
              <span>Use your camera now</span>
              <small>Preview it privately before upload.</small>
            </button>
            <button
              className="hair-dropzone hair-dropzone-secondary"
              disabled={busy}
              onClick={() => libraryInputRef.current?.click()}
              type="button"
            >
              <ImageUp size={32} />
              <strong>Upload a photo</strong>
              <span>JPEG, PNG, or WebP · up to {Math.floor(maxBytes / 1_000_000)} MB</span>
            </button>
          </div>
        )}
        <div>
          <p className="eyebrow">Photo guidance</p>
          <h2>Use a clear, natural portrait.</h2>
          <p>
            Face forward when possible and keep your hair visible. Side profiles are accepted for
            testing, but the AI can only edit details visible in the photo.
          </p>
          <p>
            <ShieldCheck size={15} /> Your original remains private and expires automatically.
          </p>
          {error !== null && <p className="error-text">{error}</p>}
        </div>
        {inputs}
      </section>
    );
  }

  return (
    <section className="hair-photo-review">
      <div className="hair-photo-frame">
        <Image alt="Selected headshot" fill sizes="460px" src={capture.previewUrl} unoptimized />
      </div>
      <div>
        <p className="eyebrow">Your headshot</p>
        <h2>Ready to use this photo?</h2>
        <p>The server will securely analyze the portrait before generating your hairstyle.</p>
        <div className="button-row">
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => onComplete(capture)}
            type="button"
          >
            {busy ? 'Uploading and checking…' : 'Use this headshot'}
          </button>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => {
              setCapture(null);
              setCameraOpen(true);
            }}
            type="button"
          >
            <Camera size={16} /> Retake
          </button>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => libraryInputRef.current?.click()}
            type="button"
          >
            <RefreshCw size={16} /> Choose another
          </button>
        </div>
        {error !== null && <p className="error-text">{error}</p>}
      </div>
      {inputs}
    </section>
  );
}
