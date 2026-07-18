'use client';

import { clientApi } from '@barber-saas/api-client';
import { HAIR_STYLE_CATALOG } from '@barber-saas/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { HairPhotoUpload, type UploadedHairImage } from '@/components/client/hair-photo-upload';
import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { HairDesign, HairScan, HairStudioConfig } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type Phase = 'consent' | 'photo' | 'styles' | 'generating' | 'result';
type Category = (typeof HAIR_STYLE_CATALOG)[number]['category'];
type DesignsResponse = { designs: HairDesign[] };

const loadingMessages = [
  'Analyzing your face shape…',
  'Understanding your features…',
  'Applying your selected style…',
  'Blending the edges…',
  'Adding final touches…',
];

const sha256 = async (blob: Blob): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

export default function HairDesignPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('consent');
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [scan, setScan] = useState<HairScan | null>(null);
  const [category, setCategory] = useState<Category>('haircut');
  const [selectedStyleId, setSelectedStyleId] = useState('textured-crop');
  const [direction, setDirection] = useState('');
  const [designId, setDesignId] = useState<string | null>(null);
  const [comparison, setComparison] = useState(50);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(0);

  const config = useQuery({
    queryKey: ['hair-studio-config'],
    queryFn: () => clientApi.hairStudioConfig<HairStudioConfig>(browserApi),
    retry: false,
  });
  const designs = useQuery({
    queryKey: ['hair-designs'],
    queryFn: () => clientApi.designs<DesignsResponse>(browserApi),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.designs.some((item) =>
        ['QUEUED', 'PROCESSING'].includes(item.generationStatus ?? ''),
      )
        ? 2000
        : false,
  });
  const design = useQuery({
    queryKey: ['hair-design', designId],
    queryFn: () => clientApi.design<HairDesign>(browserApi, designId as string),
    enabled: designId !== null,
    refetchInterval: (query) =>
      ['QUEUED', 'PROCESSING'].includes(query.state.data?.generationStatus ?? '') ? 2000 : false,
  });

  useEffect(() => {
    if (design.data?.generationStatus === 'COMPLETED') setPhase('result');
    if (design.data?.generationStatus === 'FAILED') setPhase('generating');
  }, [design.data?.generationStatus]);
  useEffect((): (() => void) | undefined => {
    if (phase !== 'generating') return;
    const timer = window.setInterval(
      () => setLoadingMessage((currentMessage) => (currentMessage + 1) % loadingMessages.length),
      1800,
    );
    return (): void => window.clearInterval(timer);
  }, [phase]);

  const selectedStyle = useMemo(
    () => HAIR_STYLE_CATALOG.find((style) => style.id === selectedStyleId),
    [selectedStyleId],
  );
  const isCustomStyle = selectedStyleId === 'custom';
  const customDescription = direction.trim();
  const canGenerate = isCustomStyle ? customDescription.length >= 3 : selectedStyle !== undefined;
  const visibleStyles = HAIR_STYLE_CATALOG.filter((style) => style.category === category);

  const upload = useMutation({
    mutationFn: async (capture: UploadedHairImage): Promise<HairScan> => {
      const activeScan =
        scan ??
        (await clientApi.createHairScan<HairScan>(browserApi, {
          consentAccepted: true,
          ageConfirmed: true,
          consentVersion: config.data?.consentVersion ?? '2026-07-17',
        }));
      setScan(activeScan);
      const presigned = await clientApi.presignHairCapture<{
        captureId: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>(browserApi, activeScan.id, {
        angle: 'FRONT',
        mimeType: capture.mimeType,
        sizeBytes: capture.blob.size,
        checksumSha256: await sha256(capture.blob),
      });
      const uploaded = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: presigned.headers,
        body: capture.blob,
      });
      if (!uploaded.ok) throw new Error('The private headshot upload failed.');
      await clientApi.completeHairCapture(browserApi, activeScan.id, presigned.captureId, {
        width: capture.width,
        height: capture.height,
      });
      return clientApi.validateHairScan<HairScan>(browserApi, activeScan.id, {});
    },
    onSuccess: (validated) => {
      setScan(validated);
      setPhase('styles');
    },
  });

  const generate = useMutation({
    mutationFn: async (): Promise<HairDesign> => {
      if (scan === null || !canGenerate) {
        throw new Error('Choose a style or describe the hairstyle you want.');
      }
      return clientApi.generateDesign<HairDesign>(browserApi, {
        scanId: scan.id,
        styleName: isCustomStyle ? customDescription.slice(0, 100) : selectedStyle?.name,
        styleCategory: isCustomStyle ? category : selectedStyle?.category,
        description: isCustomStyle
          ? customDescription
          : [selectedStyle?.description, customDescription].filter(Boolean).join(' '),
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: (created) => {
      setDesignId(created.id);
      queryClient.setQueryData(['hair-design', created.id], created);
      setPhase('generating');
      void queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
    },
  });
  const retry = useMutation({
    mutationFn: () =>
      clientApi.retryDesign<HairDesign>(browserApi, designId as string, {
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['hair-design', updated.id], updated);
      setPhase('generating');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => clientApi.deleteDesign(browserApi, id),
    onSuccess: async () => {
      setDesignId(null);
      setPhase('styles');
      await queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
    },
  });

  const activeError = upload.error ?? generate.error ?? retry.error ?? remove.error;
  const current = design.data;

  return (
    <main className="market-page hair-studio-page hair-studio-v2">
      <ClientHeader />
      <section className="market-section hair-studio-v2-header">
        <div>
          <p className="eyebrow">cutG AI Hair Studio</p>
          <h1>Preview your next look.</h1>
          <p>One clear headshot, one style direction, and a private AI visualization.</p>
        </div>
        <div className="hair-studio-trust">
          <ShieldCheck size={18} />
          Raw portraits expire after {config.data?.retentionHours ?? 24} hours
        </div>
      </section>

      <section className="market-section hair-studio-v2-shell">
        <nav className="hair-phase-nav" aria-label="Hair studio progress">
          {['Photo', 'Style', 'Preview'].map((label, index) => {
            const activeIndex =
              phase === 'consent' || phase === 'photo' ? 0 : phase === 'styles' ? 1 : 2;
            return (
              <span className={index <= activeIndex ? 'is-active' : ''} key={label}>
                {index + 1}. {label}
              </span>
            );
          })}
        </nav>

        {!config.isLoading && config.data?.enabled === false ? (
          <Notice>
            AI visualization is disabled. Your existing saved style briefs remain available.
          </Notice>
        ) : phase === 'consent' ? (
          <section className="hair-upload-layout">
            <div className="hair-upload-copy">
              <span className="hair-step-number">01</span>
              <h2>Upload one clear headshot</h2>
              <p>
                Use a front-facing photo with even light and your full hairline visible. Your image
                remains private and is used only to produce this preview.
              </p>
              <ul>
                <li>
                  <Check size={15} /> One person in frame
                </li>
                <li>
                  <Check size={15} /> No hats, filters, or dark shadows
                </li>
                <li>
                  <Check size={15} /> Front-facing headshot with your hair visible
                </li>
              </ul>
              <label className="hair-consent-check">
                <input
                  checked={adult}
                  onChange={(event) => setAdult(event.target.checked)}
                  type="checkbox"
                />
                I confirm that I am at least 18.
              </label>
              <label className="hair-consent-check">
                <input
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  type="checkbox"
                />
                I consent to private face-image processing for this preview.
              </label>
            </div>
            <button
              className="hair-dropzone"
              disabled={!adult || !consent}
              onClick={() => setPhase('photo')}
              type="button"
            >
              <Sparkles size={34} />
              <strong>Choose a headshot</strong>
              <span>Upload from your device</span>
              <small>JPEG, PNG, or WebP · up to 4 MB</small>
            </button>
          </section>
        ) : phase === 'photo' ? (
          <HairPhotoUpload
            busy={upload.isPending}
            maxBytes={config.data?.maxCaptureBytes ?? 4_000_000}
            onComplete={(capture) => upload.mutate(capture)}
          />
        ) : phase === 'styles' ? (
          <section className="hair-style-picker-v2">
            <div className="hair-style-heading">
              <div>
                <p className="eyebrow">Style direction</p>
                <h2>Choose what changes. Everything else stays you.</h2>
              </div>
              <button
                className="button button-ghost"
                onClick={() => {
                  setScan(null);
                  setPhase('photo');
                }}
                type="button"
              >
                Change photo
              </button>
            </div>
            <div className="hair-category-tabs">
              {(['haircut', 'beard', 'color', 'combo'] as Category[]).map((value) => (
                <button
                  className={category === value ? 'is-active' : ''}
                  key={value}
                  onClick={() => {
                    setCategory(value);
                    const first = HAIR_STYLE_CATALOG.find((style) => style.category === value);
                    if (first) setSelectedStyleId(first.id);
                  }}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="hair-style-options">
              {visibleStyles.map((style) => (
                <button
                  className={selectedStyleId === style.id ? 'is-selected' : ''}
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  type="button"
                >
                  <span>
                    {selectedStyleId === style.id ? <Check size={14} /> : <Sparkles size={14} />}
                  </span>
                  <strong>{style.name}</strong>
                  <small>{style.description}</small>
                </button>
              ))}
              <button
                className={selectedStyleId === 'custom' ? 'is-selected' : ''}
                onClick={() => setSelectedStyleId('custom')}
                type="button"
              >
                <span>
                  {selectedStyleId === 'custom' ? <Check size={14} /> : <Sparkles size={14} />}
                </span>
                <strong>Describe my own</strong>
                <small>Type the exact hairstyle you want the AI to create.</small>
              </button>
            </div>
            <label className="hair-direction-field">
              <span>
                {isCustomStyle
                  ? 'Describe your hairstyle (required)'
                  : 'Optional details for the AI and your barber'}
              </span>
              <textarea
                maxLength={800}
                onChange={(event) => setDirection(event.target.value)}
                placeholder={
                  isCustomStyle
                    ? 'Include length, texture, taper placement, shape, styling, facial-hair changes, and color...'
                    : 'Keep more length at the crown, soften the temple blend...'
                }
                value={direction}
              />
            </label>
            <button
              className="button button-primary"
              disabled={!canGenerate || generate.isPending}
              onClick={() => generate.mutate()}
              type="button"
            >
              <WandSparkles size={17} />
              Generate preview
            </button>
          </section>
        ) : phase === 'generating' ? (
          <section className="hair-generation-stage">
            {current?.generationStatus === 'FAILED' ? (
              <>
                <RotateCcw size={30} />
                <h2>The preview needs another pass.</h2>
                <p>{current.errorMessage ?? 'Generation could not be completed.'}</p>
                <button
                  className="button button-primary"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate()}
                  type="button"
                >
                  Retry generation
                </button>
              </>
            ) : (
              <>
                <Sparkles size={34} />
                <p className="eyebrow">AI visualization in progress</p>
                <h2>{loadingMessages[loadingMessage]}</h2>
                <p>
                  Keeping your identity. Reworking only the requested details. This page updates
                  automatically.
                </p>
                <div className="hair-progress">
                  <span style={{ width: `${Math.max(8, current?.progress ?? 8)}%` }} />
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="hair-result-v2">
            <div className="hair-result-v2-heading">
              <div>
                <p className="eyebrow">AI visualization</p>
                <h2>{current?.styleName}</h2>
              </div>
              <span>
                <Sparkles size={14} />
                AI generated
              </span>
            </div>
            <div className="hair-compare-slider">
              {current?.sourcePhotoUrl !== null && current?.sourcePhotoUrl !== undefined && (
                <Image
                  alt="Original portrait"
                  fill
                  sizes="900px"
                  src={current.sourcePhotoUrl}
                  unoptimized
                />
              )}
              <div
                className="hair-generated-layer"
                style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}
              >
                {current?.generatedPreviewUrl !== null &&
                  current?.generatedPreviewUrl !== undefined && (
                    <Image
                      alt="Generated hairstyle"
                      fill
                      sizes="900px"
                      src={current.generatedPreviewUrl}
                      unoptimized
                    />
                  )}
              </div>
              <div className="hair-compare-line" style={{ left: `${comparison}%` }}>
                <span />
              </div>
              <span className="hair-compare-label hair-compare-original">Original</span>
              <span className="hair-compare-label hair-compare-result">Preview</span>
              <input
                aria-label="Compare original and generated preview"
                max="100"
                min="0"
                onChange={(event) => setComparison(Number(event.target.value))}
                type="range"
                value={comparison}
              />
            </div>
            <Notice>
              This is an AI visualization for communicating with your barber, not a guaranteed
              haircut outcome.
            </Notice>
            <div className="button-row">
              <Link
                className="button button-primary"
                href={`/client/barbers?designId=${current?.id ?? ''}`}
              >
                Book with this style <ArrowRight size={16} />
              </Link>
              <button
                className="button button-secondary"
                onClick={() => {
                  setPhase('styles');
                  setDesignId(null);
                }}
                type="button"
              >
                <RotateCcw size={16} />
                Try another
              </button>
              <button
                className="button button-secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => setMessage('Hair Studio link copied.'))
                }
                type="button"
              >
                <Share2 size={16} />
                Share
              </button>
              <button
                className="button button-ghost"
                onClick={() => current && remove.mutate(current.id)}
                type="button"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </section>
        )}

        {activeError !== null && activeError !== undefined && (
          <Notice>{errorMessage(activeError)}</Notice>
        )}
        {message !== null && <Notice>{message}</Notice>}

        <section className="saved-looks-v2">
          <div>
            <p className="eyebrow">Private gallery</p>
            <h2>Saved looks</h2>
          </div>
          <div className="saved-look-grid-v2">
            {(designs.data?.designs ?? []).map((saved) => (
              <button
                key={saved.id}
                onClick={() => {
                  setDesignId(saved.id);
                  setPhase(saved.generationStatus === 'COMPLETED' ? 'result' : 'generating');
                }}
                type="button"
              >
                <div>
                  {saved.generatedPreviewUrl ? (
                    <Image
                      alt={saved.styleName}
                      fill
                      sizes="240px"
                      src={saved.generatedPreviewUrl}
                      unoptimized
                    />
                  ) : (
                    <Sparkles size={22} />
                  )}
                </div>
                <strong>{saved.styleName}</strong>
                <span>{saved.generationStatus?.toLowerCase() ?? saved.aiStatus}</span>
              </button>
            ))}
            {(designs.data?.designs.length ?? 0) === 0 && (
              <p className="muted">Generated looks will appear here.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
