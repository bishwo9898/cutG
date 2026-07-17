'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Clock3,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { HairScanCapture, type CapturedHairImage } from '@/components/client/hair-scan-capture';
import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type {
  ClientAppointment,
  HairDesign,
  HairScan,
  HairStudioConfig,
  HairStyleSuggestion,
} from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type DesignsResponse = { designs: HairDesign[] };
type AppointmentsResponse = { appointments: ClientAppointment[] };
type StudioPhase = 'consent' | 'camera' | 'uploading' | 'preferences' | 'styles' | 'result';

const sha256 = async (blob: Blob): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const defaultPreferences = {
  desiredLength: 'short',
  maintenance: 'low',
  texture: 'natural',
  fadePreference: 'low',
  overallStyle: 'clean',
};

export default function HairDesignPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<StudioPhase>('consent');
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [captures, setCaptures] = useState<CapturedHairImage[]>([]);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [selectedStyle, setSelectedStyle] = useState<HairStyleSuggestion | null>(null);
  const [customDirection, setCustomDirection] = useState('');
  const [designId, setDesignId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const capturesRef = useRef<CapturedHairImage[]>([]);

  const config = useQuery({
    queryKey: ['hair-studio-config'],
    queryFn: () => clientApi.hairStudioConfig<HairStudioConfig>(browserApi),
    retry: false,
  });
  const scan = useQuery({
    queryKey: ['hair-scan', scanId],
    queryFn: () => clientApi.hairScan<HairScan>(browserApi, scanId as string),
    enabled: scanId !== null && phase === 'styles',
    refetchInterval: (query) =>
      ['QUEUED', 'PROCESSING'].includes(query.state.data?.analysisStatus ?? '') ? 3000 : false,
  });
  const design = useQuery({
    queryKey: ['hair-design', designId],
    queryFn: () => clientApi.design<HairDesign>(browserApi, designId as string),
    enabled: designId !== null,
    refetchInterval: (query) =>
      ['QUEUED', 'PROCESSING'].includes(query.state.data?.generationStatus ?? '') ? 3000 : false,
  });
  const designs = useQuery({
    queryKey: ['hair-designs'],
    queryFn: () => clientApi.designs<DesignsResponse>(browserApi),
    retry: false,
  });
  const appointments = useQuery({
    queryKey: ['client-appointments', 'design-attach'],
    queryFn: () => clientApi.appointments<AppointmentsResponse>(browserApi, { upcoming: true }),
    retry: false,
  });
  const nextAppointment = useMemo(
    () =>
      (appointments.data?.appointments ?? [])
        .filter(
          (appointment) => !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status),
        )
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))[0],
    [appointments.data],
  );

  useEffect(() => {
    if (scan.data?.analysisStatus === 'COMPLETED' && selectedStyle === null) {
      setSelectedStyle(scan.data.suggestions[0] ?? null);
    }
  }, [scan.data, selectedStyle]);
  useEffect(() => {
    if (design.data?.generationStatus === 'COMPLETED') setPhase('result');
  }, [design.data]);
  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);
  useEffect((): (() => void) => {
    return (): void => {
      capturesRef.current.forEach((capture) => URL.revokeObjectURL(capture.previewUrl));
    };
  }, []);

  const createScan = useMutation({
    mutationFn: () =>
      clientApi.createHairScan<HairScan>(browserApi, {
        consentAccepted: true,
        ageConfirmed: true,
        consentVersion: config.data?.consentVersion ?? '2026-07-16',
      }),
    onSuccess: (created) => {
      setScanId(created.id);
      setPhase('camera');
    },
  });

  const uploadCaptures = useMutation({
    mutationFn: async (accepted: CapturedHairImage[]) => {
      if (scanId === null) throw new Error('The scan session was not created.');
      for (const capture of accepted) {
        const presigned = await clientApi.presignHairCapture<{
          captureId: string;
          uploadUrl: string;
          headers: Record<string, string>;
        }>(browserApi, scanId, {
          angle: capture.angle,
          mimeType: capture.blob.type,
          sizeBytes: capture.blob.size,
          checksumSha256: await sha256(capture.blob),
        });
        const response = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: presigned.headers,
          body: capture.blob,
        });
        if (!response.ok)
          throw new Error(`The ${capture.angle.toLowerCase()} capture could not be uploaded.`);
        await clientApi.completeHairCapture(browserApi, scanId, presigned.captureId, {
          width: capture.width,
          height: capture.height,
          brightness: capture.quality.brightness,
          sharpness: capture.quality.sharpness,
          faceCount: 1,
          poseScore: capture.quality.poseScore,
        });
      }
    },
    onMutate: (accepted) => {
      setCaptures(accepted);
      setPhase('uploading');
    },
    onSuccess: () => setPhase('preferences'),
  });

  const completeScan = useMutation({
    mutationFn: async () => {
      if (scanId === null) throw new Error('The scan session was not created.');
      return clientApi.completeHairScan<HairScan>(browserApi, scanId, { preferences });
    },
    onSuccess: (completed) => {
      queryClient.setQueryData(['hair-scan', scanId], completed);
      setPhase('styles');
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (scanId === null || selectedStyle === null) throw new Error('Choose a recommended style.');
      return clientApi.generateDesign<HairDesign>(browserApi, {
        scanId,
        styleName: selectedStyle.name,
        styleCategory: selectedStyle.category,
        description: [selectedStyle.description, customDirection.trim()].filter(Boolean).join(' '),
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: (created) => {
      setDesignId(created.id);
      queryClient.setQueryData(['hair-design', created.id], created);
    },
  });

  const retry = useMutation({
    mutationFn: () =>
      clientApi.retryDesign<HairDesign>(browserApi, designId as string, {
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (updated) => queryClient.setQueryData(['hair-design', updated.id], updated),
  });
  const attach = useMutation({
    mutationFn: async () => {
      if (designId === null) throw new Error('Generate a look first.');
      if (nextAppointment === undefined)
        throw new Error('Book an appointment before attaching a look.');
      return clientApi.attachDesign(browserApi, designId, nextAppointment.id);
    },
    onSuccess: () =>
      setMessage(`Attached to ${nextAppointment?.service.name ?? 'your next appointment'}.`),
  });
  const remove = useMutation({
    mutationFn: () => clientApi.deleteDesign(browserApi, designId as string),
    onSuccess: async () => {
      setDesignId(null);
      setPhase('styles');
      await queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
    },
  });

  const activeError =
    createScan.error ??
    uploadCaptures.error ??
    completeScan.error ??
    generate.error ??
    retry.error ??
    attach.error;
  const frontCapture = captures.find((capture) => capture.angle === 'FRONT');

  return (
    <main className="market-page hair-studio-page">
      <ClientHeader />
      <section className="hair-studio-header market-section">
        <div>
          <p className="eyebrow">cutG AI Hair Studio</p>
          <h1>See the cut before the chair.</h1>
          <p>Three private stills. Practical style recommendations. One realistic preview.</p>
        </div>
        <div className="hair-studio-trust">
          <ShieldCheck size={18} />
          <span>
            Raw scans automatically expire after {config.data?.retentionHours ?? 24} hours.
          </span>
        </div>
      </section>

      <section className="market-section hair-studio-content">
        {config.isSuccess && !config.data.enabled ? (
          <TextBriefFallback />
        ) : phase === 'consent' ? (
          <section className="hair-consent-panel">
            <div className="hair-consent-copy">
              <span className="hair-step-number">01</span>
              <p className="eyebrow">Before the camera</p>
              <h2>Your face stays private by design.</h2>
              <p>
                cutG captures only three accepted still images. Camera video, face landmarks, and
                rejected frames never leave this device. The preview is a visualization, not a
                guaranteed haircut result.
              </p>
              <ul>
                <li>
                  <Check size={15} /> Front, left, and right stills only
                </li>
                <li>
                  <Check size={15} /> Private storage and short-lived access links
                </li>
                <li>
                  <Check size={15} /> Delete your generated look whenever you choose
                </li>
              </ul>
            </div>
            <div className="hair-consent-actions">
              <label>
                <input
                  checked={adult}
                  onChange={(event) => setAdult(event.target.checked)}
                  type="checkbox"
                />
                <span>I confirm that I am at least 18 years old.</span>
              </label>
              <label>
                <input
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  type="checkbox"
                />
                <span>I consent to face image processing for this hairstyle preview.</span>
              </label>
              <button
                className="button button-primary"
                disabled={!adult || !consent || createScan.isPending || config.isLoading}
                onClick={() => createScan.mutate()}
                type="button"
              >
                <WandSparkles size={17} /> Begin private scan
              </button>
            </div>
          </section>
        ) : phase === 'camera' ? (
          <HairScanCapture onComplete={(accepted) => uploadCaptures.mutate(accepted)} />
        ) : phase === 'uploading' ? (
          <StudioWaiting
            title="Securing your three stills"
            copy="Images are uploading directly to private storage."
            progress={45}
          />
        ) : phase === 'preferences' ? (
          <PreferencesStep
            onBack={() => setPhase('camera')}
            onContinue={() => completeScan.mutate()}
            pending={completeScan.isPending}
            preferences={preferences}
            setPreferences={setPreferences}
          />
        ) : phase === 'styles' ? (
          <StyleStep
            customDirection={customDirection}
            design={design.data}
            generating={generate.isPending}
            onDirection={setCustomDirection}
            onGenerate={() => generate.mutate()}
            onSelect={setSelectedStyle}
            onRetry={() => retry.mutate()}
            scan={scan.data}
            selected={selectedStyle}
          />
        ) : (
          <ResultStep
            attaching={attach.isPending}
            design={design.data}
            frontCapture={frontCapture}
            isMock={config.data?.isMock ?? false}
            onAttach={() => attach.mutate()}
            onDelete={() => remove.mutate()}
            onRetry={() => {
              setDesignId(null);
              setPhase('styles');
            }}
          />
        )}

        {activeError !== null && activeError !== undefined && (
          <Notice>{errorMessage(activeError)}</Notice>
        )}
        {message !== null && <Notice tone="success">{message}</Notice>}

        <SavedLooks designs={designs.data?.designs ?? []} />
      </section>
    </main>
  );
}

function StudioWaiting({
  title,
  copy,
  progress,
}: {
  title: string;
  copy: string;
  progress: number;
}): React.ReactElement {
  return (
    <section className="hair-studio-waiting">
      <Sparkles size={28} />
      <h2>{title}</h2>
      <p>{copy}</p>
      <div className="hair-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function PreferencesStep({
  preferences,
  setPreferences,
  onBack,
  onContinue,
  pending,
}: {
  preferences: typeof defaultPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<typeof defaultPreferences>>;
  onBack: () => void;
  onContinue: () => void;
  pending: boolean;
}): React.ReactElement {
  const fields = [
    ['desiredLength', 'Desired length', ['very-short', 'short', 'medium', 'long', 'keep-length']],
    ['maintenance', 'Maintenance', ['low', 'moderate', 'high']],
    ['texture', 'Texture direction', ['natural', 'straight', 'wavy', 'curly', 'coily']],
    ['fadePreference', 'Fade preference', ['none', 'low', 'mid', 'high', 'taper']],
    ['overallStyle', 'Overall style', ['classic', 'clean', 'modern', 'bold', 'professional']],
  ] as const;
  return (
    <section className="hair-preferences-step">
      <span className="hair-step-number">02</span>
      <p className="eyebrow">Your routine, your style</p>
      <h2>What should the recommendations optimize for?</h2>
      <div className="hair-preference-grid">
        {fields.map(([key, label, values]) => (
          <label key={key}>
            <span>{label}</span>
            <select
              value={preferences[key]}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, [key]: event.target.value }))
              }
            >
              {values.map((value) => (
                <option key={value} value={value}>
                  {value.replace('-', ' ')}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="button-row">
        <button className="button button-secondary" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Retake scan
        </button>
        <button
          className="button button-primary"
          disabled={pending}
          onClick={onContinue}
          type="button"
        >
          <Sparkles size={16} /> Find my styles
        </button>
      </div>
    </section>
  );
}

function StyleStep({
  scan,
  selected,
  onSelect,
  customDirection,
  onDirection,
  onGenerate,
  generating,
  design,
  onRetry,
}: {
  scan: HairScan | undefined;
  selected: HairStyleSuggestion | null;
  onSelect: (style: HairStyleSuggestion) => void;
  customDirection: string;
  onDirection: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  design: HairDesign | undefined;
  onRetry: () => void;
}): React.ReactElement {
  if (scan === undefined || ['QUEUED', 'PROCESSING'].includes(scan.analysisStatus)) {
    return (
      <StudioWaiting
        title="Finding cuts that fit your routine"
        copy="Reviewing visible hair characteristics and your preferences without inferring sensitive traits."
        progress={scan?.analysisStatus === 'PROCESSING' ? 72 : 30}
      />
    );
  }
  if (scan.analysisStatus === 'FAILED')
    return <Notice>{scan.analysisError ?? 'Style recommendations could not be prepared.'}</Notice>;
  const processing =
    design !== undefined && ['QUEUED', 'PROCESSING'].includes(design.generationStatus ?? '');
  return (
    <section className="hair-style-step">
      <span className="hair-step-number">03</span>
      <p className="eyebrow">Three controlled recommendations</p>
      <h2>Choose the direction you want to visualize.</h2>
      <div className="hair-suggestion-grid">
        {scan.suggestions.map((suggestion) => (
          <button
            className={selected?.id === suggestion.id ? 'is-selected' : ''}
            key={suggestion.id}
            onClick={() => onSelect(suggestion)}
            type="button"
          >
            <span className="hair-suggestion-check">
              {selected?.id === suggestion.id ? <Check size={14} /> : null}
            </span>
            <strong>{suggestion.name}</strong>
            <p>{suggestion.description}</p>
            <small>{suggestion.reason}</small>
          </button>
        ))}
      </div>
      <label className="hair-direction-field">
        <span>Optional barber-level direction</span>
        <textarea
          maxLength={800}
          onChange={(event) => onDirection(event.target.value)}
          placeholder="Keep the temple blend soft, leave a little more weight at the crown..."
          value={customDirection}
        />
      </label>
      {processing ? (
        <StudioWaiting
          title="Building your preview"
          copy="Preserving your identity while changing only the hair."
          progress={design?.progress ?? 15}
        />
      ) : design?.generationStatus === 'FAILED' ? (
        <div>
          <Notice>{design.errorMessage ?? 'The preview could not be generated.'}</Notice>
          <button className="button button-secondary" onClick={onRetry} type="button">
            <RotateCcw size={16} /> Retry
          </button>
        </div>
      ) : (
        <button
          className="button button-primary"
          disabled={selected === null || generating}
          onClick={onGenerate}
          type="button"
        >
          <WandSparkles size={17} /> Generate one preview
        </button>
      )}
    </section>
  );
}

function ResultStep({
  design,
  frontCapture,
  isMock,
  onAttach,
  onDelete,
  onRetry,
  attaching,
}: {
  design: HairDesign | undefined;
  frontCapture: CapturedHairImage | undefined;
  isMock: boolean;
  onAttach: () => void;
  onDelete: () => void;
  onRetry: () => void;
  attaching: boolean;
}): React.ReactElement {
  return (
    <section className="hair-result-step">
      <div className="hair-result-heading">
        <div>
          <p className="eyebrow">Your AI visualization</p>
          <h2>{design?.styleName}</h2>
        </div>
        <span>
          <Sparkles size={15} /> AI generated
        </span>
      </div>
      <div className="hair-comparison">
        <figure>
          {frontCapture !== undefined && (
            <Image
              alt="Original front scan"
              fill
              sizes="50vw"
              src={frontCapture.previewUrl}
              unoptimized
            />
          )}
          <figcaption>Original</figcaption>
        </figure>
        <figure>
          {design?.generatedPreviewUrl !== null && design?.generatedPreviewUrl !== undefined && (
            <Image
              alt={`${design.styleName} AI hairstyle preview`}
              fill
              sizes="50vw"
              src={design.generatedPreviewUrl}
              unoptimized
            />
          )}
          <figcaption>{isMock ? 'Local demo output' : 'Generated preview'}</figcaption>
        </figure>
      </div>
      <Notice tone="success">
        This is an AI visualization for communication with your barber, not a guaranteed haircut
        outcome.
      </Notice>
      <div className="button-row">
        <button
          className="button button-primary"
          disabled={attaching}
          onClick={onAttach}
          type="button"
        >
          <Paperclip size={16} /> Attach to next booking
        </button>
        <button className="button button-secondary" onClick={onRetry} type="button">
          <RotateCcw size={16} /> Try another style
        </button>
        <button className="button button-ghost" onClick={onDelete} type="button">
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </section>
  );
}

function SavedLooks({ designs }: { designs: HairDesign[] }): React.ReactElement {
  return (
    <section className="saved-looks-section">
      <div>
        <p className="eyebrow">Your visual briefs</p>
        <h2>Saved looks</h2>
      </div>
      <div className="saved-look-grid">
        {designs.map((design) => (
          <article className="saved-look-card" key={design.id}>
            {design.generatedPreviewUrl !== null ? (
              <div className="saved-look-image">
                <Image
                  alt={design.styleName}
                  fill
                  sizes="260px"
                  src={design.generatedPreviewUrl}
                  unoptimized
                />
              </div>
            ) : (
              <Sparkles size={20} />
            )}
            <strong>{design.styleName}</strong>
            <span>{design.description ?? 'No extra notes'}</span>
            <small>
              {design.appointmentId === null ? 'Ready to attach' : 'Attached to an appointment'}
            </small>
          </article>
        ))}
        {designs.length === 0 && <p className="muted">Your saved looks will appear here.</p>}
      </div>
    </section>
  );
}

function TextBriefFallback(): React.ReactElement {
  return (
    <section className="hair-studio-waiting">
      <Clock3 size={26} />
      <h2>AI visualization is resting right now</h2>
      <p>
        You can still describe a style in your appointment notes. Your existing saved briefs remain
        available below.
      </p>
    </section>
  );
}
