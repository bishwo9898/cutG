'use client';

import { clientApi } from '@barber-saas/api-client';
import { HAIR_STYLE_CATALOG } from '@barber-saas/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  ImagePlus,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { HairDesign, HairScan, HairStudioConfig } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type Phase = 'consent' | 'upload' | 'styles' | 'generating' | 'result';
type Category = (typeof HAIR_STYLE_CATALOG)[number]['category'];
type DesignsResponse = { designs: HairDesign[] };

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];

const sha256 = async (file: File): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const imageDimensions = async (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = document.createElement('img');
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be opened.'));
    };
    image.src = url;
  });

export default function HairDesignPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('consent');
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  const designs = useQuery({
    queryKey: ['hair-designs'],
    queryFn: () => clientApi.designs<DesignsResponse>(browserApi),
    retry: false,
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
  useEffect(() => () => {
    if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectedStyle = useMemo(
    () => HAIR_STYLE_CATALOG.find((style) => style.id === selectedStyleId),
    [selectedStyleId],
  );
  const visibleStyles = HAIR_STYLE_CATALOG.filter((style) => style.category === category);

  const upload = useMutation({
    mutationFn: async (portrait: File): Promise<HairScan> => {
      const dimensions = await imageDimensions(portrait);
      if (dimensions.width < 200 || dimensions.height < 200) {
        throw new Error('Choose an image at least 200 by 200 pixels.');
      }
      const created = await clientApi.createHairScan<HairScan>(browserApi, {
        consentAccepted: true,
        ageConfirmed: true,
        consentVersion: config.data?.consentVersion ?? '2026-07-17',
      });
      const presigned = await clientApi.presignHairCapture<{
        captureId: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>(browserApi, created.id, {
        angle: 'FRONT',
        mimeType: portrait.type,
        sizeBytes: portrait.size,
        checksumSha256: await sha256(portrait),
      });
      const uploaded = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: presigned.headers,
        body: portrait,
      });
      if (!uploaded.ok) throw new Error('The private portrait upload failed.');
      await clientApi.completeHairCapture(browserApi, created.id, presigned.captureId, dimensions);
      return clientApi.validateHairScan<HairScan>(browserApi, created.id, {});
    },
    onSuccess: (validated) => {
      setScan(validated);
      setPhase('styles');
    },
  });

  const generate = useMutation({
    mutationFn: async (): Promise<HairDesign> => {
      if (scan === null || selectedStyle === undefined) throw new Error('Select a style first.');
      return clientApi.generateDesign<HairDesign>(browserApi, {
        scanId: scan.id,
        styleName: selectedStyle.name,
        styleCategory: selectedStyle.category,
        description: [selectedStyle.description, direction.trim()].filter(Boolean).join(' '),
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

  const acceptFile = (nextFile: File | undefined): void => {
    setMessage(null);
    if (nextFile === undefined) return;
    if (!acceptedTypes.includes(nextFile.type)) {
      setMessage('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (nextFile.size > 4_000_000) {
      setMessage('Choose an image smaller than 4 MB.');
      return;
    }
    if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreviewUrl(nextPreview);
    setPhase('upload');
  };

  const activeError = upload.error ?? generate.error ?? retry.error ?? remove.error;
  const current = design.data;

  return (
    <main className="market-page hair-studio-page hair-studio-v2">
      <ClientHeader />
      <section className="market-section hair-studio-v2-header">
        <div>
          <p className="eyebrow">cutG AI Hair Studio</p>
          <h1>Preview your next look.</h1>
          <p>One clear portrait, a controlled style direction, and a private AI visualization.</p>
        </div>
        <div className="hair-studio-trust">
          <ShieldCheck size={18} />
          Raw portraits expire after {config.data?.retentionHours ?? 24} hours
        </div>
      </section>

      <section className="market-section hair-studio-v2-shell">
        <nav className="hair-phase-nav" aria-label="Hair studio progress">
          {['Photo', 'Style', 'Preview'].map((label, index) => {
            const activeIndex = phase === 'consent' || phase === 'upload' ? 0 : phase === 'styles' ? 1 : 2;
            return <span className={index <= activeIndex ? 'is-active' : ''} key={label}>{index + 1}. {label}</span>;
          })}
        </nav>

        {!config.isLoading && config.data?.enabled === false ? (
          <Notice>AI visualization is disabled. Your existing saved style briefs remain available.</Notice>
        ) : phase === 'consent' ? (
          <section className="hair-upload-layout">
            <div className="hair-upload-copy">
              <span className="hair-step-number">01</span>
              <h2>Start with a clear portrait</h2>
              <p>Face the camera, use even light, and keep your full hairline visible. Your image remains private and is used only to produce this preview.</p>
              <ul>
                <li><Check size={15} /> One person in frame</li>
                <li><Check size={15} /> No hats, filters, or dark shadows</li>
                <li><Check size={15} /> JPEG, PNG, or WebP under 4 MB</li>
              </ul>
              <label className="hair-consent-check"><input checked={adult} onChange={(event) => setAdult(event.target.checked)} type="checkbox" />I confirm that I am at least 18.</label>
              <label className="hair-consent-check"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />I consent to private face-image processing for this preview.</label>
            </div>
            <button
              className="hair-dropzone"
              disabled={!adult || !consent}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files[0]); }}
              type="button"
            >
              <ImagePlus size={34} />
              <strong>Drop a portrait here</strong>
              <span>or choose from your device</span>
              <small>Private upload. No public gallery.</small>
            </button>
          </section>
        ) : phase === 'upload' ? (
          <section className="hair-photo-review">
            <div className="hair-photo-frame">{previewUrl !== null && <Image alt="Selected portrait" fill sizes="420px" src={previewUrl} unoptimized />}</div>
            <div>
              <p className="eyebrow">Portrait review</p>
              <h2>Ready for a quality check?</h2>
              <p>We will verify lighting, sharpness, framing, and that exactly one face is visible before generation.</p>
              <div className="button-row">
                <button className="button button-primary" disabled={file === null || upload.isPending} onClick={() => file !== null && upload.mutate(file)} type="button"><Upload size={16} />{upload.isPending ? 'Checking portrait...' : 'Use this portrait'}</button>
                <button className="button button-secondary" onClick={() => inputRef.current?.click()} type="button">Choose another</button>
              </div>
            </div>
          </section>
        ) : phase === 'styles' ? (
          <section className="hair-style-picker-v2">
            <div className="hair-style-heading"><div><p className="eyebrow">Style direction</p><h2>Choose what changes. Everything else stays you.</h2></div><button className="button button-ghost" onClick={() => setPhase('upload')} type="button">Change photo</button></div>
            <div className="hair-category-tabs">
              {(['haircut', 'beard', 'color', 'combo'] as Category[]).map((value) => <button className={category === value ? 'is-active' : ''} key={value} onClick={() => { setCategory(value); const first = HAIR_STYLE_CATALOG.find((style) => style.category === value); if (first) setSelectedStyleId(first.id); }} type="button">{value}</button>)}
            </div>
            <div className="hair-style-options">
              {visibleStyles.map((style) => <button className={selectedStyleId === style.id ? 'is-selected' : ''} key={style.id} onClick={() => setSelectedStyleId(style.id)} type="button"><span>{selectedStyleId === style.id ? <Check size={14} /> : <Sparkles size={14} />}</span><strong>{style.name}</strong><small>{style.description}</small></button>)}
            </div>
            <label className="hair-direction-field"><span>Optional details for the AI and your barber</span><textarea maxLength={800} onChange={(event) => setDirection(event.target.value)} placeholder="Keep more length at the crown, soften the temple blend..." value={direction} /></label>
            <button className="button button-primary" disabled={generate.isPending} onClick={() => generate.mutate()} type="button"><WandSparkles size={17} />Generate preview</button>
          </section>
        ) : phase === 'generating' ? (
          <section className="hair-generation-stage">
            {current?.generationStatus === 'FAILED' ? <><RotateCcw size={30} /><h2>The preview needs another pass.</h2><p>{current.errorMessage ?? 'Generation could not be completed.'}</p><button className="button button-primary" disabled={retry.isPending} onClick={() => retry.mutate()} type="button">Retry generation</button></> : <><Sparkles size={34} /><p className="eyebrow">AI visualization in progress</p><h2>Keeping your identity. Reworking only the hair.</h2><p>Preparing strands, blend, texture, and realistic lighting. This page updates automatically.</p><div className="hair-progress"><span style={{ width: `${Math.max(8, current?.progress ?? 8)}%` }} /></div></>}
          </section>
        ) : (
          <section className="hair-result-v2">
            <div className="hair-result-v2-heading"><div><p className="eyebrow">AI visualization</p><h2>{current?.styleName}</h2></div><span><Sparkles size={14} />AI generated</span></div>
            <div className="hair-compare-slider">
              {current?.sourcePhotoUrl !== null && current?.sourcePhotoUrl !== undefined && <Image alt="Original portrait" fill sizes="900px" src={current.sourcePhotoUrl} unoptimized />}
              <div className="hair-generated-layer" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}>{current?.generatedPreviewUrl !== null && current?.generatedPreviewUrl !== undefined && <Image alt="Generated hairstyle" fill sizes="900px" src={current.generatedPreviewUrl} unoptimized />}</div>
              <div className="hair-compare-line" style={{ left: `${comparison}%` }}><span /></div>
              <span className="hair-compare-label hair-compare-original">Original</span><span className="hair-compare-label hair-compare-result">Preview</span>
              <input aria-label="Compare original and generated preview" max="100" min="0" onChange={(event) => setComparison(Number(event.target.value))} type="range" value={comparison} />
            </div>
            <Notice>This is an AI visualization for communicating with your barber, not a guaranteed haircut outcome.</Notice>
            <div className="button-row">
              <Link className="button button-primary" href={`/barbers?designId=${current?.id ?? ''}`}>Book with this style <ArrowRight size={16} /></Link>
              <button className="button button-secondary" onClick={() => { setPhase('styles'); setDesignId(null); }} type="button"><RotateCcw size={16} />Try another</button>
              <button className="button button-secondary" onClick={() => void navigator.clipboard.writeText(window.location.href).then(() => setMessage('Hair Studio link copied.'))} type="button"><Share2 size={16} />Share</button>
              <button className="button button-ghost" onClick={() => current && remove.mutate(current.id)} type="button"><Trash2 size={16} />Delete</button>
            </div>
          </section>
        )}

        <input accept={acceptedTypes.join(',')} hidden onChange={(event) => acceptFile(event.target.files?.[0])} ref={inputRef} type="file" />
        {activeError !== null && activeError !== undefined && <Notice>{errorMessage(activeError)}</Notice>}
        {message !== null && <Notice>{message}</Notice>}

        <section className="saved-looks-v2">
          <div><p className="eyebrow">Private gallery</p><h2>Saved looks</h2></div>
          <div className="saved-look-grid-v2">
            {(designs.data?.designs ?? []).map((saved) => <button key={saved.id} onClick={() => { setDesignId(saved.id); setPhase(saved.generationStatus === 'COMPLETED' ? 'result' : 'generating'); }} type="button"><div>{saved.generatedPreviewUrl ? <Image alt={saved.styleName} fill sizes="240px" src={saved.generatedPreviewUrl} unoptimized /> : <Sparkles size={22} />}</div><strong>{saved.styleName}</strong><span>{saved.generationStatus?.toLowerCase() ?? saved.aiStatus}</span></button>)}
            {(designs.data?.designs.length ?? 0) === 0 && <p className="muted">Generated looks will appear here.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
