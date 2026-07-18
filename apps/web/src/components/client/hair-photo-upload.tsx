'use client';

import { ImageUp, RefreshCw, ShieldCheck } from 'lucide-react';
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

export function HairPhotoUpload({
  busy = false,
  maxBytes = 4_000_000,
  onComplete,
}: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [capture, setCapture] = useState<UploadedHairImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => (): void => {
      if (capture !== null) URL.revokeObjectURL(capture.previewUrl);
    },
    [capture],
  );

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

  if (capture === null) {
    return (
      <section className="hair-photo-review">
        <button
          className="hair-dropzone"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <ImageUp size={38} />
          <strong>Upload one clear headshot</strong>
          <span>JPEG, PNG, or WebP · up to {Math.floor(maxBytes / 1_000_000)} MB</span>
          <small>Use a front-facing photo with your full hairline visible.</small>
        </button>
        <div>
          <p className="eyebrow">Photo guidance</p>
          <h2>A simple portrait works best.</h2>
          <p>
            Use even lighting, face forward, and include only one person. Avoid hats and filters.
          </p>
          <p>
            <ShieldCheck size={15} /> Your original remains private and expires automatically.
          </p>
          {error !== null && <p className="error-text">{error}</p>}
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            void chooseFile(event.target.files?.[0]);
            event.target.value = '';
          }}
          ref={inputRef}
          type="file"
        />
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
        <h2>Ready to check this photo?</h2>
        <p>The server will verify image quality and that one front-facing person is visible.</p>
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
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <RefreshCw size={16} /> Choose another
          </button>
        </div>
        {error !== null && <p className="error-text">{error}</p>}
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.target.value = '';
        }}
        ref={inputRef}
        type="file"
      />
    </section>
  );
}
