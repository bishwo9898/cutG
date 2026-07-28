'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Cloud, Scissors, Sparkles, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { HairDesign } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

export default function SavedLookDetailPage(): React.ReactElement {
  const { designId } = useParams<{ designId: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [comparison, setComparison] = useState(50);
  const design = useQuery({
    queryKey: ['hair-design', designId],
    queryFn: () => clientApi.design<HairDesign>(browserApi, designId),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  });
  const remove = useMutation({
    mutationFn: () => clientApi.deleteDesign(browserApi, designId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
      router.replace('/client/design');
    },
  });

  return (
    <main className="market-page hair-studio-page hair-studio-v2 saved-look-detail-page">
      <ClientHeader />
      {design.isLoading ? (
        <LoadingState />
      ) : design.error !== null || design.data === undefined ? (
        <ErrorState message={errorMessage(design.error)} />
      ) : (
        <>
          <section className="market-section saved-look-detail-header">
            <div>
              <p className="eyebrow">Private gallery</p>
              <h1>{design.data.styleName}</h1>
              <p>
                Compare the saved original with the generated preview and keep the exact style
                direction ready for your barber.
              </p>
            </div>
            <div className="saved-look-storage-badge">
              {design.data.imageStorage === 'cloudinary' ? (
                <Cloud size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {design.data.imageStorage === 'cloudinary'
                ? 'Stored privately on Cloudinary'
                : 'Stored in private object storage'}
            </div>
          </section>

          <section className="market-section saved-look-detail-shell">
            <div className="saved-look-detail-grid">
              {[
                ['Original', design.data.sourcePhotoUrl],
                ['AI preview', design.data.generatedPreviewUrl],
              ].map(([label, source]) => (
                <a
                  className="saved-look-detail-image"
                  href={source ?? undefined}
                  key={label}
                  rel="noreferrer"
                  target="_blank"
                >
                  {source ? (
                    <Image
                      alt={`${label} for ${design.data.styleName}`}
                      fill
                      onError={() => void design.refetch()}
                      priority
                      sizes="50vw"
                      src={source}
                      unoptimized
                    />
                  ) : (
                    <Sparkles size={30} />
                  )}
                  <span>{label}</span>
                </a>
              ))}
            </div>

            {design.data.sourcePhotoUrl && design.data.generatedPreviewUrl && (
              <div>
                <div className="saved-look-compare-heading">
                  <div>
                    <p className="eyebrow">Difference view</p>
                    <h2>Drag to compare</h2>
                  </div>
                  <span>{comparison}% preview</span>
                </div>
                <div className="hair-compare-slider saved-look-detail-compare">
                  <Image
                    alt="Original portrait"
                    fill
                    onError={() => void design.refetch()}
                    sizes="900px"
                    src={design.data.sourcePhotoUrl}
                    unoptimized
                  />
                  <div
                    className="hair-generated-layer"
                    style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}
                  >
                    <Image
                      alt="Generated hairstyle"
                      fill
                      onError={() => void design.refetch()}
                      sizes="900px"
                      src={design.data.generatedPreviewUrl}
                      unoptimized
                    />
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
              </div>
            )}

            <aside className="saved-look-detail-notes">
              <div>
                <span>Style category</span>
                <strong>{design.data.styleCategory}</strong>
              </div>
              <div>
                <span>Created</span>
                <strong>
                  <CalendarDays size={15} />
                  {new Date(design.data.createdAt).toLocaleDateString([], {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </div>
              <div className="saved-look-detail-direction">
                <span>Direction for your barber</span>
                <p>{design.data.description ?? 'No extra direction was added for this look.'}</p>
              </div>
            </aside>

            {remove.error !== null && <ErrorState message={errorMessage(remove.error)} />}
            <div className="button-row saved-look-detail-actions">
              <Link className="button button-primary" href={`/client/barbers?designId=${designId}`}>
                <Scissors size={16} /> Book with this look
              </Link>
              <Link className="button button-secondary" href="/client/design">
                <Sparkles size={16} /> Create another
              </Link>
              <button
                className="button button-ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                type="button"
              >
                <Trash2 size={16} /> {remove.isPending ? 'Deleting…' : 'Delete look'}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
