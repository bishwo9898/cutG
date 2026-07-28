'use client';

import { clientApi } from '@barber-saas/api-client';
import { HAIR_STYLE_CATALOG } from '@barber-saas/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
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

import { HairPhotoUpload, type HairPhotoSelection } from '@/components/client/hair-photo-upload';
import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { useSavedHairDesigns } from '@/hooks/use-saved-hair-designs';
import { useUser } from '@/hooks/use-user';
import { browserApi } from '@/lib/browser-api';
import type { HairDesign, HairScan, HairStudioConfig, HairStudioConsent } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type Phase = 'consent' | 'photo' | 'styles' | 'generating' | 'result';
type Category = (typeof HAIR_STYLE_CATALOG)[number]['category'];

const generationLabel = (status: HairDesign['generationStatus'], progress: number): string => {
  if (status === 'QUEUED') return 'Queued securely';
  if (progress >= 85) return 'Saving your preview';
  if (progress >= 45) return 'Generating your preview';
  return 'Preparing your requested edit';
};

const sha256 = async (blob: Blob): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

export default function HairDesignPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
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

  const config = useQuery({
    queryKey: ['hair-studio-config'],
    queryFn: () => clientApi.hairStudioConfig<HairStudioConfig>(browserApi),
    retry: false,
  });
  const consentStatus = useQuery({
    queryKey: ['hair-studio-consent'],
    queryFn: () => clientApi.hairStudioConsent<HairStudioConsent>(browserApi),
    retry: false,
  });
  const designs = useSavedHairDesigns(user?.userType === 'CLIENT' ? user.id : null);
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
  useEffect(() => {
    if (consentStatus.data?.accepted === true) {
      setAdult(true);
      setConsent(true);
      setPhase((currentPhase) => (currentPhase === 'consent' ? 'photo' : currentPhase));
    }
  }, [consentStatus.data?.accepted]);
  const selectedStyle = useMemo(
    () => HAIR_STYLE_CATALOG.find((style) => style.id === selectedStyleId),
    [selectedStyleId],
  );
  const isCustomStyle = selectedStyleId === 'custom';
  const customDescription = direction.trim();
  const canGenerate = isCustomStyle ? customDescription.length >= 3 : selectedStyle !== undefined;
  const visibleStyles = HAIR_STYLE_CATALOG.filter((style) => style.category === category);

  const upload = useMutation({
    mutationFn: async (selection: HairPhotoSelection): Promise<HairScan> => {
      const activeScan = await clientApi.createHairScan<HairScan>(browserApi, {
        consentAccepted: true,
        ageConfirmed: true,
        consentVersion: config.data?.consentVersion ?? '2026-07-17',
      });
      setScan(activeScan);
      for (const capture of selection.captures) {
        const presigned = await clientApi.presignHairCapture<{
          captureId: string;
          uploadUrl: string;
          headers: Record<string, string>;
        }>(browserApi, activeScan.id, {
          angle: capture.angle,
          mimeType: capture.mimeType,
          sizeBytes: capture.blob.size,
          checksumSha256: await sha256(capture.blob),
        });
        const uploaded = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: presigned.headers,
          body: capture.blob,
        });
        if (!uploaded.ok) {
          throw new Error(`The private ${capture.angle.toLowerCase()} photo upload failed.`);
        }
        await clientApi.completeHairCapture(browserApi, activeScan.id, presigned.captureId, {
          width: capture.width,
          height: capture.height,
          brightness: capture.quality?.brightness,
          sharpness: capture.quality?.sharpness,
          faceCount: capture.quality?.faceCount,
          poseScore: capture.quality?.poseScore,
        });
      }
      return clientApi.validateHairScan<HairScan>(browserApi, activeScan.id, {});
    },
    onSuccess: (validated) => {
      setScan(validated);
      setPhase('styles');
    },
  });
  const acceptConsent = useMutation({
    mutationFn: () =>
      clientApi.acceptHairStudioConsent<HairStudioConsent>(browserApi, {
        consentAccepted: true,
        ageConfirmed: true,
        consentVersion: config.data?.consentVersion ?? '2026-07-17',
      }),
    onSuccess: (accepted) => {
      queryClient.setQueryData(['hair-studio-consent'], accepted);
      setPhase('photo');
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

  const activeError =
    consentStatus.error ??
    acceptConsent.error ??
    upload.error ??
    generate.error ??
    retry.error ??
    remove.error;
  const current = design.data;
  const generationProgress = Math.min(100, Math.max(0, current?.progress ?? 0));

  return (
    <main className="market-page hair-studio-page hair-studio-v2">
      <ClientHeader />
      <section className="market-section hair-studio-v2-header">
        <div>
          <p className="eyebrow">cutG AI Hair Studio</p>
          <h1>Preview your next look.</h1>
          <p>A quick guided face scan, one style direction, and a private AI visualization.</p>
        </div>
        <div className="hair-studio-trust">
          <ShieldCheck size={18} />
          {config.data?.imageStorage === 'cloudinary'
            ? 'Saved looks stay private in your account'
            : `Raw portraits expire after ${config.data?.retentionHours ?? 24} hours`}
        </div>
      </section>

      <section className="market-section hair-studio-v2-shell" id="hair-studio-start">
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

        {config.data?.isMock === true && (
          <Notice>
            Demo provider is active. It verifies the private upload and job pipeline, but returns
            the original portrait unchanged. A configured production image provider is required to
            generate a different hairstyle.
          </Notice>
        )}

        {!config.isLoading && config.data?.enabled === false ? (
          <Notice>
            AI visualization is disabled. Your existing saved style briefs remain available.
          </Notice>
        ) : consentStatus.isLoading ? (
          <section className="hair-studio-waiting">
            <Sparkles size={30} />
            <h2>Preparing your private studio…</h2>
          </section>
        ) : phase === 'consent' || phase === 'photo' ? (
          <HairPhotoUpload
            busy={upload.isPending || phase === 'consent'}
            maxBytes={config.data?.maxCaptureBytes ?? 4_000_000}
            onComplete={(selection) => upload.mutate(selection)}
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
                <h2>{generationLabel(current?.generationStatus ?? null, generationProgress)}</h2>
                <p>
                  This bar advances only when the generation service completes a real processing
                  milestone.
                </p>
                <div
                  aria-label="AI generation progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={generationProgress}
                  className="hair-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${generationProgress}%` }} />
                </div>
                <strong className="hair-progress-value">{generationProgress}%</strong>
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

        {phase === 'consent' && !consentStatus.isLoading && (
          <div className="hair-consent-backdrop">
            <section
              aria-labelledby="hair-consent-title"
              aria-modal="true"
              className="hair-consent-modal"
              role="dialog"
            >
              <span className="hair-consent-icon">
                <ShieldCheck size={23} />
              </span>
              <p className="eyebrow">One-time confirmation</p>
              <h2 id="hair-consent-title">Your face. Your choice.</h2>
              <p>
                We need your permission to process a face image for private hairstyle previews. Once
                accepted, this message will not appear again unless the privacy notice changes.
              </p>
              <ul>
                <li>
                  <Check size={15} /> Camera guidance runs on this device
                </li>
                <li>
                  <Check size={15} /> Images are used only for your private preview
                </li>
                <li>
                  <Check size={15} /> Saved looks can be deleted from your account
                </li>
              </ul>
              <div className="hair-consent-choices">
                <label>
                  <input
                    checked={adult}
                    onChange={(event) => setAdult(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I confirm that I am at least 18.</span>
                </label>
                <label>
                  <input
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I consent to private face-image processing for this preview.</span>
                </label>
              </div>
              {acceptConsent.error !== null && (
                <p className="error-text">{errorMessage(acceptConsent.error)}</p>
              )}
              <div className="hair-consent-buttons">
                <button
                  className="button button-primary"
                  disabled={!adult || !consent || acceptConsent.isPending}
                  onClick={() => acceptConsent.mutate()}
                  type="button"
                >
                  <Sparkles size={16} />
                  {acceptConsent.isPending ? 'Saving…' : 'Agree and start'}
                </button>
                <Link className="button button-ghost" href="/client">
                  Not now
                </Link>
              </div>
              <small>
                Saved securely to this account · consent version {config.data?.consentVersion}
              </small>
            </section>
          </div>
        )}

        <section className="saved-looks-v2">
          <div className="saved-looks-heading">
            <div>
              <p className="eyebrow">Private gallery</p>
              <h2>Saved looks</h2>
            </div>
            {designs.isFetching && designs.data !== undefined && (
              <span className="saved-looks-sync">
                <Sparkles size={13} /> Checking your gallery…
              </span>
            )}
          </div>
          <div className="saved-look-grid-v2">
            {(designs.data?.designs ?? []).map((saved) => (
              <Link
                className="saved-look-card-v2"
                href={`/client/design/${saved.id}`}
                key={saved.id}
              >
                <div>
                  {saved.generatedPreviewUrl ? (
                    <Image
                      alt={saved.styleName}
                      fill
                      onError={() => void designs.refetch()}
                      sizes="240px"
                      src={saved.generatedPreviewUrl}
                      unoptimized
                    />
                  ) : (
                    <Sparkles size={22} />
                  )}
                </div>
                <span className="saved-look-card-v2-copy">
                  <strong>{saved.styleName}</strong>
                  <small>
                    {saved.generationStatus?.toLowerCase() ?? saved.aiStatus}
                    {saved.imageStorage === 'cloudinary' ? ' · Cloudinary' : ''}
                  </small>
                </span>
                <ArrowUpRight className="saved-look-card-v2-arrow" size={18} />
              </Link>
            ))}
            {designs.isLoading && <p className="muted">Loading your private gallery…</p>}
            {!designs.isLoading && (designs.data?.designs.length ?? 0) === 0 && (
              <div className="saved-look-empty-v2">
                <span>
                  <Sparkles size={22} />
                </span>
                <div>
                  <strong>You have not saved a look yet.</strong>
                  <p>
                    Try AI Hair Studio once, then bring the result directly into your next booking.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setPhase('photo');
                    document
                      .getElementById('hair-studio-start')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  type="button"
                >
                  Create my first look
                </button>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
