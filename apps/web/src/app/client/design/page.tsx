'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Paperclip, Save, Sparkles, Upload } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { ClientAppointment, HairDesign } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';
import { HAIR_STYLE_PRESETS, type HairStyleCategory } from '@/lib/hair-styles';

type DesignsResponse = { designs: HairDesign[] };
type AppointmentsResponse = { appointments: ClientAppointment[] };

export default function HairDesignPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<HairStyleCategory>('haircut');
  const [styleName, setStyleName] = useState('Fade');
  const [description, setDescription] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
  useEffect(
    (): (() => void) => () => {
      if (photoPreview !== null) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const create = useMutation({
    mutationFn: () =>
      clientApi.createDesign<HairDesign>(browserApi, {
        styleName,
        styleCategory: category,
        description: description.trim() || undefined,
      }),
    onSuccess: async (design) => {
      setMessage('Look saved. Your barber can use the description immediately.');
      await queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
      return design;
    },
  });
  const attach = useMutation({
    mutationFn: async () => {
      if (nextAppointment === undefined)
        throw new Error('Book an appointment before attaching a look.');
      const design = create.data ?? (await create.mutateAsync());
      return clientApi.attachDesign(browserApi, design.id, nextAppointment.id);
    },
    onSuccess: async () => {
      setMessage(`Attached to ${nextAppointment?.service.name ?? 'your next appointment'}.`);
      await queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
    },
  });

  return (
    <main className="market-page">
      <ClientHeader />
      <section className="market-section design-studio-shell">
        <div className="section-title">
          <div>
            <p className="eyebrow">Tell your barber exactly what you want</p>
            <h1>Hair Design Studio</h1>
            <p>Build a clear style brief now. AI visualization will plug into this studio next.</p>
          </div>
          <Sparkles size={28} />
        </div>

        <div className="design-studio-grid">
          <div className="design-workflow">
            <section className="design-step">
              <div className="design-step-heading">
                <span>1</span>
                <h2>Add your photo</h2>
              </div>
              <label className="photo-upload-zone">
                {photoPreview === null ? (
                  <>
                    <Camera size={30} />
                    <strong>Choose a front-facing photo</strong>
                    <span>Good lighting and visible hair work best.</span>
                  </>
                ) : (
                  <Image
                    alt="Your selected style reference"
                    fill
                    sizes="(max-width: 700px) 100vw, 420px"
                    src={photoPreview}
                    unoptimized
                  />
                )}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file === undefined) return;
                    if (photoPreview !== null) URL.revokeObjectURL(photoPreview);
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                  type="file"
                />
                <span className="button button-secondary">
                  <Upload size={15} /> {photoPreview === null ? 'Upload photo' : 'Replace photo'}
                </span>
              </label>
            </section>

            <section className="design-step">
              <div className="design-step-heading">
                <span>2</span>
                <h2>Choose a direction</h2>
              </div>
              <div className="segmented-control design-category-tabs">
                {(Object.keys(HAIR_STYLE_PRESETS) as HairStyleCategory[]).map((value) => (
                  <button
                    className={category === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => {
                      setCategory(value);
                      setStyleName(HAIR_STYLE_PRESETS[value][0].name);
                    }}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="style-preset-grid">
                {HAIR_STYLE_PRESETS[category].map((style) => (
                  <button
                    className={styleName === style.name ? 'is-selected' : ''}
                    key={style.id}
                    onClick={() => setStyleName(style.name)}
                    type="button"
                  >
                    <strong>{style.name}</strong>
                    <span>{style.description}</span>
                    {styleName === style.name && <Check size={16} />}
                  </button>
                ))}
              </div>
            </section>

            <section className="design-step">
              <div className="design-step-heading">
                <span>3</span>
                <h2>Describe the details</h2>
              </div>
              <textarea
                className="textarea design-description"
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Example: low skin fade on the sides, keep about two inches on top, natural texture and a clean neckline"
                value={description}
              />
              <button
                className="button button-primary"
                disabled={styleName.length === 0}
                onClick={() => setGenerated(true)}
                type="button"
              >
                <Sparkles size={16} /> Generate preview
              </button>
            </section>
          </div>

          <aside className="design-preview-panel">
            <p className="eyebrow">Preview</p>
            <Sparkles size={34} />
            <h2>{generated ? 'AI preview coming soon' : 'Your look starts here'}</h2>
            <p>
              {generated
                ? 'Your style brief is ready now. Image generation will be added without changing this booking workflow.'
                : 'Choose a style and describe the finish you want your barber to see.'}
            </p>
            <div className="design-brief-preview">
              <strong>{styleName}</strong>
              <span>
                {description.trim() ||
                  HAIR_STYLE_PRESETS[category].find((style) => style.name === styleName)
                    ?.description}
              </span>
            </div>
            <div className="button-row">
              <button
                className="button button-secondary"
                disabled={create.isPending}
                onClick={() => create.mutate()}
                type="button"
              >
                <Save size={15} /> Save look
              </button>
              <button
                className="button button-primary"
                disabled={attach.isPending}
                onClick={() => attach.mutate()}
                type="button"
              >
                <Paperclip size={15} /> Attach to next booking
              </button>
            </div>
            {(create.isError || attach.isError) && (
              <Notice>{errorMessage(create.error ?? attach.error)}</Notice>
            )}
            {message !== null && <Notice tone="success">{message}</Notice>}
          </aside>
        </div>

        <section className="saved-looks-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Saved</p>
              <h2>My looks</h2>
            </div>
          </div>
          <div className="saved-look-grid">
            {(designs.data?.designs ?? []).map((design) => (
              <article className="saved-look-card" key={design.id}>
                <Sparkles size={20} />
                <strong>{design.styleName}</strong>
                <span>{design.description ?? 'No extra notes'}</span>
                <small>
                  {design.appointmentId === null ? 'Ready to attach' : 'Attached to an appointment'}
                </small>
              </article>
            ))}
            {designs.data !== undefined && designs.data.designs.length === 0 && (
              <p className="muted">Your saved looks will appear here.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
