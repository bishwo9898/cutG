'use client';

import { ApiError } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BarChart3,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  ImagePlus,
  Images,
  MapPin,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import {
  ShopLocationEditor,
  type ShopLocationValue,
} from '@/components/barber/shop-location-editor';
import { Notice } from '@/components/notice';
import { BeforeAfterSlider } from '@/components/portfolio/before-after-slider';
import { ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type {
  BarberPortfolio,
  BarberProfile,
  PortfolioCategory,
  PortfolioItem,
} from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

const categories: Array<{ value: PortfolioCategory; label: string }> = [
  { value: 'BURST_FADE', label: 'Burst fade' },
  { value: 'MID_FADE', label: 'Mid fade' },
  { value: 'LOW_FADE', label: 'Low fade' },
  { value: 'HIGH_FADE', label: 'High fade' },
  { value: 'TAPER', label: 'Taper' },
  { value: 'CURLY', label: 'Curly' },
  { value: 'AFRO', label: 'Afro' },
  { value: 'BEARD', label: 'Beard' },
  { value: 'SCISSOR_CUTS', label: 'Scissor cuts' },
  { value: 'KIDS', label: 'Kids' },
  { value: 'LONG_HAIR', label: 'Long hair' },
  { value: 'DESIGNS', label: 'Designs' },
];

type EditorTab = 'identity' | 'gallery' | 'career';
type PortfolioView = 'edit' | 'preview';
type IdentityDraft = {
  businessName: string;
  headline: string;
  businessType: 'INDEPENDENT' | 'SHOP';
  bio: string;
  yearsOfExperience: string;
  languages: string;
  specialties: string;
};
type GalleryDraft = {
  title: string;
  description: string;
  category: PortfolioCategory;
  hairType: 'STRAIGHT' | 'WAVY' | 'CURLY' | 'COILY';
  hairDensity: 'THIN' | 'MEDIUM' | 'THICK';
  hairLengthBefore: string;
  hairLengthAfter: string;
  faceShape: 'OVAL' | 'ROUND' | 'SQUARE';
  cutStyle: string;
  timeTakenMinutes: string;
  productsUsed: string;
  difficulty: 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED';
  isFeatured: boolean;
};

const initialIdentity: IdentityDraft = {
  businessName: '',
  headline: '',
  businessType: 'INDEPENDENT',
  bio: '',
  yearsOfExperience: '',
  languages: '',
  specialties: '',
};
const initialGallery: GalleryDraft = {
  title: '',
  description: '',
  category: 'TAPER',
  hairType: 'CURLY',
  hairDensity: 'MEDIUM',
  hairLengthBefore: '',
  hairLengthAfter: '',
  faceShape: 'OVAL',
  cutStyle: '',
  timeTakenMinutes: '45',
  productsUsed: '',
  difficulty: 'INTERMEDIATE',
  isFeatured: false,
};

const commaList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const uploadAsset = async <T,>(path: string, file: File): Promise<T> => {
  const response = await fetch(`/api/backend${path}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'The upload could not be completed.');
  return body;
};

const monthLabel = (month: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(`${month}-01T12:00:00`));

const shopLocationFor = (profile: BarberProfile | undefined): ShopLocationValue | null => {
  if (
    profile?.address === null ||
    profile?.address === undefined ||
    profile.latitude === null ||
    profile.longitude === null
  ) {
    return null;
  }
  const city = profile.city ?? '';
  const state = profile.state ?? '';
  const zipCode = profile.zipCode ?? '';
  return {
    name: profile.businessName,
    address: profile.address,
    city,
    state,
    zipCode,
    country: 'US',
    latitude: profile.latitude,
    longitude: profile.longitude,
    formattedAddress: [profile.address, city, state, zipCode].filter(Boolean).join(', '),
    source: 'saved',
  };
};

function PortfolioEditorContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [view, setView] = useState<PortfolioView>(() =>
    searchParams.get('view') === 'preview' ? 'preview' : 'edit',
  );
  const [tab, setTab] = useState<EditorTab>('identity');
  const [identity, setIdentity] = useState<IdentityDraft>(initialIdentity);
  const [shopLocation, setShopLocation] = useState<ShopLocationValue | null>(null);
  const [gallery, setGallery] = useState<GalleryDraft>(initialGallery);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [experience, setExperience] = useState({
    shopName: '',
    title: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
  });
  const [certification, setCertification] = useState({
    name: '',
    issuer: '',
    issueDate: '',
    expirationDate: '',
    credentialId: '',
    credentialUrl: '',
  });
  const profile = useQuery({
    queryKey: ['barber-profile'],
    queryFn: () => browserApi.get<BarberProfile>('/barbers/me'),
    retry: false,
  });
  const missing =
    profile.error instanceof ApiError && profile.error.code === 'BARBER_PROFILE_NOT_FOUND';
  const portfolio = useQuery({
    queryKey: ['barber-portfolio'],
    queryFn: () => browserApi.get<BarberPortfolio>('/barbers/me/portfolio'),
    enabled: profile.isSuccess,
  });

  useEffect(() => {
    if (profile.data === undefined) return;
    setIdentity({
      businessName: profile.data.businessName,
      headline: profile.data.headline ?? '',
      businessType: profile.data.businessType,
      bio: profile.data.bio ?? '',
      yearsOfExperience:
        profile.data.yearsOfExperience === null ? '' : String(profile.data.yearsOfExperience),
      languages: profile.data.languages.join(', '),
      specialties: profile.data.specialties.join(', '),
    });
    setShopLocation(shopLocationFor(profile.data));
  }, [profile.data]);

  const refreshPortfolio = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['barber-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['barber-portfolio'] }),
      queryClient.invalidateQueries({ queryKey: ['public-barber'] }),
      queryClient.invalidateQueries({ queryKey: ['public-barber-portfolio'] }),
    ]);
  };

  const saveIdentity = useMutation({
    mutationFn: async () => {
      if (identity.businessName.trim() === '') {
        throw new Error('Add a display or shop name before saving.');
      }
      const body = {
        businessName: identity.businessName,
        headline: identity.headline,
        businessType: identity.businessType,
        bio: identity.bio,
        yearsOfExperience:
          identity.yearsOfExperience === '' ? undefined : Number(identity.yearsOfExperience),
        languages: commaList(identity.languages),
        specialties: commaList(identity.specialties),
        ...(shopLocation === null
          ? {}
          : {
              address: shopLocation.address,
              city: shopLocation.city,
              state: shopLocation.state,
              zipCode: shopLocation.zipCode,
              latitude: shopLocation.latitude,
              longitude: shopLocation.longitude,
            }),
      };
      const savedProfile = missing
        ? await browserApi.post<BarberProfile>('/barbers/me/profile', body)
        : await browserApi.patch<BarberProfile>('/barbers/me/profile', body);
      return savedProfile;
    },
    onSuccess: refreshPortfolio,
  });

  const assetUpload = useMutation({
    mutationFn: ({ kind, file }: { kind: 'photo' | 'banner'; file: File }) =>
      uploadAsset(`/barbers/me/portfolio/${kind}`, file),
    onSuccess: refreshPortfolio,
  });

  const addGalleryWork = useMutation({
    mutationFn: async () => {
      if (beforeFile === null || afterFile === null) {
        throw new Error('Choose both a before and an after photo.');
      }
      const created = await browserApi.post<PortfolioItem>('/barbers/me/portfolio/items', {
        ...gallery,
        timeTakenMinutes: Number(gallery.timeTakenMinutes),
        productsUsed: commaList(gallery.productsUsed),
      });
      await uploadAsset(`/barbers/me/portfolio/items/${created.id}/images/before`, beforeFile);
      await uploadAsset(`/barbers/me/portfolio/items/${created.id}/images/after`, afterFile);
      return created;
    },
    onSuccess: async () => {
      setGallery(initialGallery);
      setBeforeFile(null);
      setAfterFile(null);
      await refreshPortfolio();
    },
  });

  const addExperience = useMutation({
    mutationFn: () =>
      browserApi.post('/barbers/me/portfolio/experience', {
        shopName: experience.shopName,
        title: experience.title,
        location: experience.location || undefined,
        startDate: experience.startDate,
        endDate: experience.isCurrent ? undefined : experience.endDate,
        isCurrent: experience.isCurrent,
        description: experience.description || undefined,
      }),
    onSuccess: async () => {
      setExperience({
        shopName: '',
        title: '',
        location: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
      });
      await refreshPortfolio();
    },
  });

  const addCertification = useMutation({
    mutationFn: () =>
      browserApi.post('/barbers/me/portfolio/certifications', {
        name: certification.name,
        issuer: certification.issuer,
        issueDate: certification.issueDate || undefined,
        expirationDate: certification.expirationDate || undefined,
        credentialId: certification.credentialId || undefined,
        credentialUrl: certification.credentialUrl || undefined,
      }),
    onSuccess: async () => {
      setCertification({
        name: '',
        issuer: '',
        issueDate: '',
        expirationDate: '',
        credentialId: '',
        credentialUrl: '',
      });
      await refreshPortfolio();
    },
  });

  const removeEntry = useMutation({
    mutationFn: (path: string) => browserApi.delete(path),
    onSuccess: refreshPortfolio,
  });

  const completion = useMemo(() => {
    const detailReady =
      identity.businessName.length > 0 &&
      identity.headline.length > 0 &&
      identity.bio.length > 0 &&
      identity.yearsOfExperience.length > 0 &&
      commaList(identity.languages).length > 0;
    return (
      (detailReady ? 30 : 0) +
      (profile.data?.profilePhotoUrl !== null && profile.data?.profilePhotoUrl !== undefined
        ? 15
        : 0) +
      (profile.data?.bannerUrl !== null && profile.data?.bannerUrl !== undefined ? 15 : 0) +
      ((portfolio.data?.items.length ?? 0) > 0 ? 20 : 0) +
      ((portfolio.data?.experiences.length ?? 0) > 0 ? 10 : 0) +
      ((portfolio.data?.certifications.length ?? 0) > 0 ? 10 : 0)
    );
  }, [identity, portfolio.data, profile.data]);

  if (profile.isPending) return <LoadingState />;
  if (profile.isError && !missing) {
    return (
      <main className="page">
        <ErrorState message={errorMessage(profile.error)} />
      </main>
    );
  }

  const maximumRepeat = Math.max(
    1,
    ...(portfolio.data?.trust.monthlyRepeatClients.map((item) => item.repeatClients) ?? []),
  );

  const editorHeader = (
    <header className="portfolio-editor-header">
      <div>
        <p className="eyebrow">Public presence</p>
        <h1>Portfolio</h1>
        <p>
          Manage your profile, shop location, visual work, and professional background in one place.
        </p>
      </div>
      <div className="portfolio-view-toggle" role="group" aria-label="Portfolio view">
        <button
          aria-pressed={view === 'edit'}
          className={view === 'edit' ? 'is-active' : ''}
          onClick={() => setView('edit')}
          type="button"
        >
          <Pencil size={15} /> Edit
        </button>
        <button
          aria-pressed={view === 'preview'}
          className={view === 'preview' ? 'is-active' : ''}
          disabled={missing}
          onClick={() => setView('preview')}
          type="button"
        >
          <Eye size={16} /> Public preview
        </button>
      </div>
    </header>
  );

  if (view === 'preview') {
    return (
      <main className="page barber-portfolio-editor">
        {editorHeader}
        <section className="portfolio-live-preview">
          {missing || profile.data === undefined ? (
            <div className="portfolio-preview-empty">
              <Eye size={24} />
              <h2>Create a profile when you are ready</h2>
              <p>Your public preview will appear here after you save a display or shop name.</p>
              <button
                className="button button-primary"
                onClick={() => setView('edit')}
                type="button"
              >
                Start editing
              </button>
            </div>
          ) : (
            <>
              <div className="portfolio-preview-toolbar">
                <div>
                  <span className="portfolio-preview-status" />
                  <strong>Live customer view</strong>
                  <small>Updates appear after each save.</small>
                </div>
                <a
                  className="button button-secondary"
                  href={`/client/barbers/${profile.data.id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open full page <ExternalLink size={15} />
                </a>
              </div>
              <iframe
                src={`/client/barbers/${profile.data.id}?preview=1`}
                title={`${profile.data.businessName} public portfolio preview`}
              />
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page barber-portfolio-editor">
      {editorHeader}

      {!missing && (
        <section className="portfolio-completion-card">
          <div className="portfolio-completion-score">
            <strong>{completion}%</strong>
            <span>portfolio strength</span>
          </div>
          <div>
            <div className="portfolio-completion-copy">
              <strong>
                {completion >= 90
                  ? 'Your profile tells a complete story.'
                  : 'A few details can make your profile more convincing.'}
              </strong>
              <span>Identity · Visual proof · Career credibility</span>
            </div>
            <div className="portfolio-completion-track">
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>
        </section>
      )}

      <nav className="portfolio-editor-tabs" aria-label="Portfolio sections">
        {(
          [
            ['identity', UserRound, 'Profile & location'],
            ['gallery', Images, 'Work gallery'],
            ['career', BriefcaseBusiness, 'Experience'],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            className={tab === value ? 'is-active' : ''}
            key={value}
            onClick={() => setTab(value)}
            type="button"
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {tab === 'identity' && (
        <div className="portfolio-editor-grid">
          <section className="portfolio-editor-panel">
            <div className="portfolio-panel-heading">
              <span>
                <Sparkles size={18} />
              </span>
              <div>
                <h2>Your first impression</h2>
                <p>Keep it specific, human, and easy to scan.</p>
              </div>
            </div>
            {(saveIdentity.error !== null || assetUpload.error !== null) && (
              <Notice>{errorMessage(saveIdentity.error ?? assetUpload.error)}</Notice>
            )}
            {saveIdentity.isSuccess && <Notice tone="success">Portfolio details saved.</Notice>}
            <div className="form-stack">
              <div className="form-row">
                <div className="field">
                  <label htmlFor="portfolio-business-name">Display or shop name</label>
                  <input
                    className="input"
                    id="portfolio-business-name"
                    onChange={(event) =>
                      setIdentity((value) => ({ ...value, businessName: event.target.value }))
                    }
                    placeholder="Jordan or Jordan's Studio"
                    value={identity.businessName}
                  />
                </div>
                <div className="field">
                  <label htmlFor="portfolio-business-type">How you work</label>
                  <select
                    className="select"
                    id="portfolio-business-type"
                    onChange={(event) =>
                      setIdentity((value) => ({
                        ...value,
                        businessType: event.target.value as IdentityDraft['businessType'],
                      }))
                    }
                    value={identity.businessType}
                  >
                    <option value="INDEPENDENT">Independent barber</option>
                    <option value="SHOP">Shop or studio</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="portfolio-headline">Professional headline</label>
                <input
                  className="input"
                  id="portfolio-headline"
                  maxLength={160}
                  onChange={(event) =>
                    setIdentity((value) => ({ ...value, headline: event.target.value }))
                  }
                  placeholder="Precision fades · Textured hair specialist"
                  value={identity.headline}
                />
                <span className="field-help">
                  The one line customers remember after leaving your page.
                </span>
              </div>
              <div className="field">
                <label htmlFor="portfolio-bio">Short bio</label>
                <textarea
                  className="textarea"
                  id="portfolio-bio"
                  maxLength={1000}
                  onChange={(event) =>
                    setIdentity((value) => ({ ...value, bio: event.target.value }))
                  }
                  placeholder="Tell customers who you serve, what you specialize in, and how you want them to feel."
                  rows={5}
                  value={identity.bio}
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="portfolio-years">Years of experience</label>
                  <input
                    className="input"
                    id="portfolio-years"
                    max={60}
                    min={0}
                    onChange={(event) =>
                      setIdentity((value) => ({
                        ...value,
                        yearsOfExperience: event.target.value,
                      }))
                    }
                    type="number"
                    value={identity.yearsOfExperience}
                  />
                </div>
                <div className="field">
                  <label htmlFor="portfolio-languages">Languages</label>
                  <input
                    className="input"
                    id="portfolio-languages"
                    onChange={(event) =>
                      setIdentity((value) => ({ ...value, languages: event.target.value }))
                    }
                    placeholder="English, Spanish"
                    value={identity.languages}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="portfolio-specialties">Specialties</label>
                <input
                  className="input"
                  id="portfolio-specialties"
                  onChange={(event) =>
                    setIdentity((value) => ({ ...value, specialties: event.target.value }))
                  }
                  placeholder="Textured hair, modern tapers, beard shaping"
                  value={identity.specialties}
                />
                <span className="field-help">Separate each specialty with a comma.</span>
              </div>
            </div>
          </section>

          <aside className="portfolio-media-panel">
            <div className="portfolio-panel-heading">
              <span>
                <Camera size={18} />
              </span>
              <div>
                <h2>Profile media</h2>
                <p>Use clear, recent media that feels like your work.</p>
              </div>
            </div>
            <div className="portfolio-media-preview is-portrait">
              {profile.data?.profilePhotoUrl !== null &&
              profile.data?.profilePhotoUrl !== undefined ? (
                <img alt="Current profile" src={profile.data.profilePhotoUrl} />
              ) : (
                <UserRound size={32} />
              )}
            </div>
            <label className="button button-secondary portfolio-file-button">
              <Upload size={16} />
              Upload profile photo
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={assetUpload.isPending || missing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) assetUpload.mutate({ kind: 'photo', file });
                }}
                type="file"
              />
            </label>
            <div className="portfolio-banner-preview">
              {profile.data?.bannerUrl === null || profile.data?.bannerUrl === undefined ? (
                <div>
                  <ImagePlus size={28} />
                  <span>Banner image or short video</span>
                </div>
              ) : profile.data.bannerAssetType === 'video' ? (
                <video autoPlay loop muted playsInline src={profile.data.bannerUrl} />
              ) : (
                <img alt="Current portfolio banner" src={profile.data.bannerUrl} />
              )}
            </div>
            <label className="button button-secondary portfolio-file-button">
              <Upload size={16} />
              Upload banner
              <input
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                disabled={assetUpload.isPending || missing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) assetUpload.mutate({ kind: 'banner', file });
                }}
                type="file"
              />
            </label>
            {missing && (
              <p className="portfolio-media-help">
                Save a display or shop name first, then add your photos.
              </p>
            )}
          </aside>

          {missing ? (
            <section className="portfolio-location-placeholder">
              <MapPin size={24} />
              <div>
                <h2>Shop location</h2>
                <p>Save your profile once to enable live shop search and map suggestions.</p>
              </div>
            </section>
          ) : (
            <div className="portfolio-location-panel">
              <ShopLocationEditor
                businessName={identity.businessName}
                idPrefix="portfolio-shop"
                onChange={setShopLocation}
                value={shopLocation}
              />
            </div>
          )}

          <div className="portfolio-merged-save">
            <div>
              <strong>
                {missing ? 'Create your profile when you are ready' : 'Save profile changes'}
              </strong>
              <span>
                Your identity, specialties, and confirmed shop location are saved together.
              </span>
            </div>
            <button
              className="button button-primary"
              disabled={saveIdentity.isPending}
              onClick={() => saveIdentity.mutate()}
              type="button"
            >
              {saveIdentity.isPending ? <span className="spinner" /> : <Save size={17} />}
              {missing ? 'Create profile' : 'Save portfolio profile'}
            </button>
          </div>
        </div>
      )}

      {missing && tab !== 'identity' && (
        <section className="portfolio-section-unavailable">
          <Images size={24} />
          <h2>This section is ready when you are</h2>
          <p>
            Add a display or shop name first. You can still use every other workspace tab in the
            sidebar before completing your portfolio.
          </p>
          <button
            className="button button-primary"
            onClick={() => setTab('identity')}
            type="button"
          >
            Add profile name
          </button>
        </section>
      )}

      {!missing && tab === 'gallery' && (
        <div className="portfolio-gallery-editor">
          <section className="portfolio-editor-panel">
            <div className="portfolio-panel-heading">
              <span>
                <ImagePlus size={18} />
              </span>
              <div>
                <h2>Add before-and-after work</h2>
                <p>Metadata helps the right customer recognize their hair in your work.</p>
              </div>
            </div>
            {addGalleryWork.error !== null && <Notice>{errorMessage(addGalleryWork.error)}</Notice>}
            <div className="portfolio-upload-pair">
              <label>
                <span>Before photo</span>
                <strong>{beforeFile?.name ?? 'Choose image'}</strong>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setBeforeFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
              <ChevronRight size={20} />
              <label>
                <span>After photo</span>
                <strong>{afterFile?.name ?? 'Choose image'}</strong>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setAfterFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
            </div>
            <div className="form-stack">
              <div className="form-row">
                <div className="field">
                  <label htmlFor="work-title">Work title</label>
                  <input
                    className="input"
                    id="work-title"
                    onChange={(event) =>
                      setGallery((value) => ({ ...value, title: event.target.value }))
                    }
                    placeholder="Textured low taper"
                    value={gallery.title}
                  />
                </div>
                <div className="field">
                  <label htmlFor="work-category">Category</label>
                  <select
                    className="select"
                    id="work-category"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        category: event.target.value as PortfolioCategory,
                      }))
                    }
                    value={gallery.category}
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="work-description">What made this cut work?</label>
                <textarea
                  className="textarea"
                  id="work-description"
                  onChange={(event) =>
                    setGallery((value) => ({ ...value, description: event.target.value }))
                  }
                  rows={3}
                  value={gallery.description}
                />
              </div>
              <div className="portfolio-metadata-grid">
                <div className="field">
                  <label htmlFor="work-hair-type">Hair type</label>
                  <select
                    className="select"
                    id="work-hair-type"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        hairType: event.target.value as GalleryDraft['hairType'],
                      }))
                    }
                    value={gallery.hairType}
                  >
                    {['STRAIGHT', 'WAVY', 'CURLY', 'COILY'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="work-density">Density</label>
                  <select
                    className="select"
                    id="work-density"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        hairDensity: event.target.value as GalleryDraft['hairDensity'],
                      }))
                    }
                    value={gallery.hairDensity}
                  >
                    {['THIN', 'MEDIUM', 'THICK'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="work-face-shape">Face shape</label>
                  <select
                    className="select"
                    id="work-face-shape"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        faceShape: event.target.value as GalleryDraft['faceShape'],
                      }))
                    }
                    value={gallery.faceShape}
                  >
                    {['OVAL', 'ROUND', 'SQUARE'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="work-difficulty">Difficulty</label>
                  <select
                    className="select"
                    id="work-difficulty"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        difficulty: event.target.value as GalleryDraft['difficulty'],
                      }))
                    }
                    value={gallery.difficulty}
                  >
                    <option value="FOUNDATIONAL">Foundational</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="work-length-before">Length before</label>
                  <input
                    className="input"
                    id="work-length-before"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        hairLengthBefore: event.target.value,
                      }))
                    }
                    placeholder="3 inches on top"
                    value={gallery.hairLengthBefore}
                  />
                </div>
                <div className="field">
                  <label htmlFor="work-length-after">Length after</label>
                  <input
                    className="input"
                    id="work-length-after"
                    onChange={(event) =>
                      setGallery((value) => ({
                        ...value,
                        hairLengthAfter: event.target.value,
                      }))
                    }
                    placeholder="1.5 inches, skin taper"
                    value={gallery.hairLengthAfter}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="work-cut-style">Cut style</label>
                  <input
                    className="input"
                    id="work-cut-style"
                    onChange={(event) =>
                      setGallery((value) => ({ ...value, cutStyle: event.target.value }))
                    }
                    placeholder="Low taper with curl definition"
                    value={gallery.cutStyle}
                  />
                </div>
                <div className="field">
                  <label htmlFor="work-time">Time taken</label>
                  <div className="input-suffix">
                    <input
                      className="input"
                      id="work-time"
                      max={480}
                      min={5}
                      onChange={(event) =>
                        setGallery((value) => ({
                          ...value,
                          timeTakenMinutes: event.target.value,
                        }))
                      }
                      type="number"
                      value={gallery.timeTakenMinutes}
                    />
                    <span>min</span>
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="work-products">Products used</label>
                <input
                  className="input"
                  id="work-products"
                  onChange={(event) =>
                    setGallery((value) => ({ ...value, productsUsed: event.target.value }))
                  }
                  placeholder="Curl cream, matte clay, holding spray"
                  value={gallery.productsUsed}
                />
              </div>
              <label className="checkbox-row">
                <input
                  checked={gallery.isFeatured}
                  onChange={(event) =>
                    setGallery((value) => ({ ...value, isFeatured: event.target.checked }))
                  }
                  type="checkbox"
                />
                Feature this work near the top of my gallery
              </label>
              <button
                className="button button-primary"
                disabled={addGalleryWork.isPending}
                onClick={() => addGalleryWork.mutate()}
                type="button"
              >
                {addGalleryWork.isPending ? <span className="spinner" /> : <Plus size={17} />}
                {addGalleryWork.isPending ? 'Publishing work…' : 'Add to portfolio'}
              </button>
            </div>
          </section>

          <section className="portfolio-published-work">
            <div className="portfolio-panel-heading">
              <span>
                <Images size={18} />
              </span>
              <div>
                <h2>Published work</h2>
                <p>
                  {portfolio.data?.items.length ?? 0} before-and-after{' '}
                  {(portfolio.data?.items.length ?? 0) === 1 ? 'story' : 'stories'}
                </p>
              </div>
            </div>
            {(portfolio.data?.items.length ?? 0) === 0 ? (
              <div className="portfolio-empty">
                <ImagePlus size={26} />
                <strong>Your gallery is ready for its first transformation.</strong>
                <p>Both images stay private until the pair is fully uploaded.</p>
              </div>
            ) : (
              <div className="portfolio-editor-work-list">
                {portfolio.data?.items.map((item) => (
                  <article key={item.id}>
                    {item.beforeImageUrl !== null && item.afterImageUrl !== null ? (
                      <BeforeAfterSlider
                        afterUrl={item.afterImageUrl}
                        beforeUrl={item.beforeImageUrl}
                        title={item.title}
                      />
                    ) : (
                      <div className="portfolio-work-processing">Finish both images to publish</div>
                    )}
                    <div>
                      <span>{categories.find(({ value }) => value === item.category)?.label}</span>
                      <h3>{item.title}</h3>
                      <p>
                        {item.hairType.toLowerCase()} · {item.hairDensity.toLowerCase()} ·{' '}
                        {item.timeTakenMinutes} min
                      </p>
                    </div>
                    <button
                      aria-label={`Remove ${item.title}`}
                      className="button button-ghost"
                      disabled={removeEntry.isPending}
                      onClick={() => removeEntry.mutate(`/barbers/me/portfolio/items/${item.id}`)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!missing && tab === 'career' && (
        <div className="portfolio-career-layout">
          <div className="portfolio-career-column">
            <section className="portfolio-editor-panel">
              <div className="portfolio-panel-heading">
                <span>
                  <BriefcaseBusiness size={18} />
                </span>
                <div>
                  <h2>Work experience</h2>
                  <p>Build a clear, credible career timeline.</p>
                </div>
              </div>
              {addExperience.error !== null && <Notice>{errorMessage(addExperience.error)}</Notice>}
              <div className="form-stack">
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="experience-shop">Shop or business</label>
                    <input
                      className="input"
                      id="experience-shop"
                      onChange={(event) =>
                        setExperience((value) => ({ ...value, shopName: event.target.value }))
                      }
                      value={experience.shopName}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="experience-title">Title</label>
                    <input
                      className="input"
                      id="experience-title"
                      onChange={(event) =>
                        setExperience((value) => ({ ...value, title: event.target.value }))
                      }
                      placeholder="Senior barber"
                      value={experience.title}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="experience-location">Location</label>
                  <input
                    className="input"
                    id="experience-location"
                    onChange={(event) =>
                      setExperience((value) => ({ ...value, location: event.target.value }))
                    }
                    value={experience.location}
                  />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="experience-start">Started</label>
                    <input
                      className="input"
                      id="experience-start"
                      onChange={(event) =>
                        setExperience((value) => ({ ...value, startDate: event.target.value }))
                      }
                      type="date"
                      value={experience.startDate}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="experience-end">Ended</label>
                    <input
                      className="input"
                      disabled={experience.isCurrent}
                      id="experience-end"
                      onChange={(event) =>
                        setExperience((value) => ({ ...value, endDate: event.target.value }))
                      }
                      type="date"
                      value={experience.endDate}
                    />
                  </div>
                </div>
                <label className="checkbox-row">
                  <input
                    checked={experience.isCurrent}
                    onChange={(event) =>
                      setExperience((value) => ({
                        ...value,
                        isCurrent: event.target.checked,
                        endDate: event.target.checked ? '' : value.endDate,
                      }))
                    }
                    type="checkbox"
                  />
                  I currently work here
                </label>
                <div className="field">
                  <label htmlFor="experience-description">What you did</label>
                  <textarea
                    className="textarea"
                    id="experience-description"
                    onChange={(event) =>
                      setExperience((value) => ({ ...value, description: event.target.value }))
                    }
                    rows={3}
                    value={experience.description}
                  />
                </div>
                <button
                  className="button button-secondary"
                  disabled={addExperience.isPending}
                  onClick={() => addExperience.mutate()}
                  type="button"
                >
                  <Plus size={17} /> Add experience
                </button>
              </div>
            </section>
            <div className="portfolio-career-list">
              {portfolio.data?.experiences.map((item) => (
                <article key={item.id}>
                  <span className="portfolio-career-mark">
                    <BriefcaseBusiness size={16} />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <strong>{item.shopName}</strong>
                    <p>
                      {item.startDate.slice(0, 4)} –{' '}
                      {item.isCurrent ? 'Present' : item.endDate?.slice(0, 4)}
                      {item.location === null ? '' : ` · ${item.location}`}
                    </p>
                    {item.description !== null && <small>{item.description}</small>}
                  </div>
                  <button
                    aria-label={`Remove ${item.shopName}`}
                    onClick={() =>
                      removeEntry.mutate(`/barbers/me/portfolio/experience/${item.id}`)
                    }
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="portfolio-career-column">
            <section className="portfolio-editor-panel">
              <div className="portfolio-panel-heading">
                <span>
                  <Award size={18} />
                </span>
                <div>
                  <h2>Licenses & certifications</h2>
                  <p>Add credentials customers can understand at a glance.</p>
                </div>
              </div>
              {addCertification.error !== null && (
                <Notice>{errorMessage(addCertification.error)}</Notice>
              )}
              <div className="form-stack">
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="certification-name">Certification</label>
                    <input
                      className="input"
                      id="certification-name"
                      onChange={(event) =>
                        setCertification((value) => ({ ...value, name: event.target.value }))
                      }
                      placeholder="Barber license"
                      value={certification.name}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="certification-issuer">Issuing organization</label>
                    <input
                      className="input"
                      id="certification-issuer"
                      onChange={(event) =>
                        setCertification((value) => ({ ...value, issuer: event.target.value }))
                      }
                      value={certification.issuer}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="certification-issued">Issued</label>
                    <input
                      className="input"
                      id="certification-issued"
                      onChange={(event) =>
                        setCertification((value) => ({
                          ...value,
                          issueDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={certification.issueDate}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="certification-expires">Expires</label>
                    <input
                      className="input"
                      id="certification-expires"
                      onChange={(event) =>
                        setCertification((value) => ({
                          ...value,
                          expirationDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={certification.expirationDate}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="certification-id">Credential ID</label>
                  <input
                    className="input"
                    id="certification-id"
                    onChange={(event) =>
                      setCertification((value) => ({
                        ...value,
                        credentialId: event.target.value,
                      }))
                    }
                    value={certification.credentialId}
                  />
                </div>
                <div className="field">
                  <label htmlFor="certification-url">Credential link</label>
                  <input
                    className="input"
                    id="certification-url"
                    onChange={(event) =>
                      setCertification((value) => ({
                        ...value,
                        credentialUrl: event.target.value,
                      }))
                    }
                    placeholder="https://"
                    type="url"
                    value={certification.credentialUrl}
                  />
                </div>
                <button
                  className="button button-secondary"
                  disabled={addCertification.isPending}
                  onClick={() => addCertification.mutate()}
                  type="button"
                >
                  <Plus size={17} /> Add credential
                </button>
              </div>
            </section>
            <div className="portfolio-certification-list">
              {portfolio.data?.certifications.map((item) => (
                <article key={item.id}>
                  <span>
                    <Check size={17} />
                  </span>
                  <div>
                    <h3>{item.name}</h3>
                    <strong>{item.issuer}</strong>
                    {item.issueDate !== null && <p>Issued {item.issueDate.slice(0, 4)}</p>}
                    {item.credentialUrl !== null && (
                      <a href={item.credentialUrl} rel="noreferrer" target="_blank">
                        Show credential
                      </a>
                    )}
                  </div>
                  <button
                    aria-label={`Remove ${item.name}`}
                    onClick={() =>
                      removeEntry.mutate(`/barbers/me/portfolio/certifications/${item.id}`)
                    }
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          </div>

          <section className="portfolio-retention-preview">
            <div>
              <span>
                <BarChart3 size={18} />
              </span>
              <div>
                <p className="eyebrow">Customer loyalty</p>
                <h2>Retention builds automatically</h2>
                <p>
                  Completed appointments power this private preview and the public trust signal. No
                  customer identities are shown.
                </p>
              </div>
            </div>
            <strong>
              {portfolio.data?.trust.repeatClientPercentage === null ||
              portfolio.data?.trust.repeatClientPercentage === undefined
                ? '—'
                : `${portfolio.data.trust.repeatClientPercentage}%`}
              <span>return within 60 days</span>
            </strong>
            <div className="portfolio-mini-chart" aria-label="Monthly repeat customers">
              {portfolio.data?.trust.monthlyRepeatClients.map((item) => (
                <div key={item.month}>
                  <span
                    style={{
                      height: `${Math.max(8, (item.repeatClients / maximumRepeat) * 100)}%`,
                    }}
                  />
                  <small>{monthLabel(item.month)}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function PortfolioEditorPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortfolioEditorContent />
    </Suspense>
  );
}
