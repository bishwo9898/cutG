'use client';

import { CreateServiceSchema } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  ImagePlus,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Notice } from '@/components/notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { BarberService } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type FormValues = z.infer<typeof CreateServiceSchema>;
type ServiceResponse = { services: BarberService[]; total: number };
type ServiceCategory = BarberService['category'];
const categories: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'haircut', label: 'Haircuts' },
  { value: 'beard', label: 'Beard' },
  { value: 'shave', label: 'Shave' },
  { value: 'color', label: 'Color' },
  { value: 'combo', label: 'Combos' },
  { value: 'kids', label: 'Kids' },
  { value: 'other', label: 'Other' },
];
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImageSizeBytes = 5 * 1024 * 1024;

const serviceImageRequest = async (
  serviceId: string,
  method: 'POST' | 'DELETE',
  file?: File,
): Promise<BarberService> => {
  const response = await fetch(`/api/backend/barbers/me/services/${serviceId}/image`, {
    method,
    ...(file === undefined
      ? {}
      : {
          body: file,
          headers: { 'Content-Type': file.type },
        }),
  });
  const body = (await response.json()) as BarberService & { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? 'The service image could not be updated.');
  }
  return body;
};

export default function ServicesPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BarberService | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<ServiceCategory>('haircut');
  const [visibleCategory, setVisibleCategory] = useState<ServiceCategory | 'all'>('all');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [serviceActive, setServiceActive] = useState(true);
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => browserApi.get<ServiceResponse>('/barbers/me/services'),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateServiceSchema),
    defaultValues: { category: 'haircut', durationMinutes: 30 },
  });

  useEffect(() => {
    if (editing !== null) {
      reset({
        name: editing.name,
        description: editing.description ?? undefined,
        price: editing.price,
        durationMinutes: editing.durationMinutes,
        category: editing.category,
      });
      setServiceActive(editing.isActive);
    } else {
      reset({ name: '', description: '', price: 0, durationMinutes: 30, category: createCategory });
      setServiceActive(true);
    }
  }, [createCategory, editing, reset]);

  useEffect(() => {
    if (imageFile === null) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return (): void => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      let service =
        editing === null
          ? await browserApi.post<BarberService>('/barbers/me/services', values)
          : await browserApi.patch<BarberService>(`/barbers/me/services/${editing.id}`, {
              ...values,
              isActive: serviceActive,
            });

      try {
        if (editing !== null && removeImage && imageFile === null && editing.imageUrl !== null) {
          service = await serviceImageRequest(service.id, 'DELETE');
        }
        if (imageFile !== null) {
          service = await serviceImageRequest(service.id, 'POST', imageFile);
        }
      } catch (error) {
        if (editing === null) {
          setEditing(service);
          await queryClient.invalidateQueries({ queryKey: ['services'] });
        }
        throw error;
      }
      return service;
    },
    onSuccess: async () => {
      setDrawerOpen(false);
      setEditing(null);
      setImageFile(null);
      setRemoveImage(false);
      setImageError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['public-services'] }),
        queryClient.invalidateQueries({ queryKey: ['public-barber-services'] }),
      ]);
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => browserApi.delete(`/barbers/me/services/${id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['public-services'] }),
        queryClient.invalidateQueries({ queryKey: ['public-barber-services'] }),
      ]);
    },
  });

  const openCreate = (category: ServiceCategory = 'haircut'): void => {
    setCreateCategory(category);
    setEditing(null);
    setImageFile(null);
    setRemoveImage(false);
    setImageError(null);
    setDrawerOpen(true);
  };

  const openEdit = (service: BarberService): void => {
    setEditing(service);
    setImageFile(null);
    setRemoveImage(false);
    setImageError(null);
    setDrawerOpen(true);
  };

  const selectImage = (file: File | undefined): void => {
    if (file === undefined) return;
    if (!supportedImageTypes.includes(file.type)) {
      setImageError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > maxImageSizeBytes) {
      setImageError('Choose an image smaller than 5 MB.');
      return;
    }
    setImageError(null);
    setRemoveImage(false);
    setImageFile(file);
  };

  const allServices = services.data?.services ?? [];
  const activeServices = allServices.filter((service) => service.isActive);
  const inactiveServices = allServices.filter((service) => !service.isActive);
  const visibleServices = activeServices.filter(
    (service) => visibleCategory === 'all' || service.category === visibleCategory,
  );
  const displayedImageUrl = imagePreviewUrl ?? (removeImage ? null : (editing?.imageUrl ?? null));

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Services</h1>
          <p>Keep your menu focused, priced clearly, and easy to book.</p>
        </div>
        <button className="button button-primary" onClick={() => openCreate()} type="button">
          <Plus size={17} />
          Add service
        </button>
      </div>
      {deactivate.isError && <Notice>{errorMessage(deactivate.error)}</Notice>}
      {services.isPending ? (
        <LoadingState />
      ) : services.isError ? (
        <section className="panel">
          <ErrorState message={errorMessage(services.error)} />
        </section>
      ) : services.data.services.length === 0 ? (
        <section className="panel">
          <EmptyState
            title="Your service menu is empty"
            detail="Add the cuts and treatments customers can book."
            action={
              <button className="button button-primary" onClick={() => openCreate()} type="button">
                <Plus size={17} />
                Add first service
              </button>
            }
          />
        </section>
      ) : (
        <>
          <section className="service-manager">
            <div className="service-manager-toolbar">
              <div>
                <strong>{activeServices.length} active services</strong>
                <span>Changes appear on your public profile immediately.</span>
              </div>
              <nav className="service-category-pills" aria-label="Filter services by category">
                <button
                  className={visibleCategory === 'all' ? 'is-active' : ''}
                  onClick={() => setVisibleCategory('all')}
                  type="button"
                >
                  All {activeServices.length}
                </button>
                {categories
                  .map((category) => ({
                    ...category,
                    count: activeServices.filter((service) => service.category === category.value)
                      .length,
                  }))
                  .filter((category) => category.count > 0 || category.value === visibleCategory)
                  .map((category) => (
                    <button
                      className={visibleCategory === category.value ? 'is-active' : ''}
                      key={category.value}
                      onClick={() => setVisibleCategory(category.value)}
                      type="button"
                    >
                      {category.label} {category.count}
                    </button>
                  ))}
              </nav>
            </div>

            {visibleServices.length === 0 ? (
              <div className="service-filter-empty">
                <Scissors size={22} />
                <strong>No active services in this category</strong>
                <button
                  className="button button-secondary"
                  onClick={() =>
                    openCreate(visibleCategory === 'all' ? 'haircut' : visibleCategory)
                  }
                  type="button"
                >
                  <Plus size={15} /> Add service
                </button>
              </div>
            ) : (
              <div className="service-manager-grid">
                {visibleServices.map((service) => (
                  <article className="service-manager-card" key={service.id}>
                    {service.imageUrl !== null && (
                      <img alt={`${service.name} service`} src={service.imageUrl} />
                    )}
                    <div className="service-manager-card-body">
                      <div className="service-manager-card-heading">
                        <span>
                          {categories.find((item) => item.value === service.category)?.label}
                        </span>
                        <span className="badge badge-success">
                          <Check size={12} /> Active
                        </span>
                      </div>
                      <h2>{service.name}</h2>
                      {service.description !== null && <p>{service.description}</p>}
                      <div className="service-manager-meta">
                        <strong>${service.price.toFixed(2)}</strong>
                        <span>
                          <Clock3 size={14} /> {service.durationMinutes} min
                        </span>
                      </div>
                    </div>
                    <div className="service-manager-actions">
                      <button
                        className="button button-secondary"
                        onClick={() => openEdit(service)}
                        type="button"
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        className="button button-ghost service-archive-button"
                        disabled={deactivate.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Archive ${service.name}? Customers will no longer be able to book it.`,
                            )
                          ) {
                            deactivate.mutate(service.id);
                          }
                        }}
                        type="button"
                      >
                        <Archive size={15} /> Archive
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {inactiveServices.length > 0 && (
              <details className="inactive-services">
                <summary>
                  <ChevronDown size={16} /> Inactive services ({inactiveServices.length})
                </summary>
                {inactiveServices.map((service) => (
                  <button key={service.id} onClick={() => openEdit(service)} type="button">
                    <span>{service.name}</span>
                    <small>
                      {service.category} · ${service.price.toFixed(2)} · Edit to reactivate
                    </small>
                  </button>
                ))}
              </details>
            )}
          </section>
        </>
      )}
      {drawerOpen && (
        <div className="drawer-backdrop" role="presentation">
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Service editor">
            <div className="drawer-header">
              <h2>{editing === null ? 'Add a service' : 'Edit service'}</h2>
              <button
                className="icon-button"
                onClick={() => setDrawerOpen(false)}
                title="Close"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <form className="form-stack" onSubmit={handleSubmit((values) => save.mutate(values))}>
              {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
              <div className="service-image-field">
                <div className="field-label-row">
                  <label>Service photo</label>
                  <span>Optional · JPEG, PNG, or WebP · 5 MB max</span>
                </div>
                {displayedImageUrl === null ? (
                  <label className="service-image-picker">
                    <ImagePlus size={24} />
                    <strong>Add a service photo</strong>
                    <span>Help customers understand the result at a glance.</span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => selectImage(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                ) : (
                  <div className="service-image-preview">
                    <img alt="Service preview" src={displayedImageUrl} />
                    <div>
                      <label className="button button-secondary">
                        <Camera size={15} /> Replace
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => selectImage(event.target.files?.[0])}
                          type="file"
                        />
                      </label>
                      <button
                        className="button button-ghost"
                        onClick={() => {
                          setImageFile(null);
                          setRemoveImage(true);
                          setImageError(null);
                        }}
                        type="button"
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    </div>
                  </div>
                )}
                {imageError !== null && <span className="field-error">{imageError}</span>}
              </div>
              <div className="field">
                <label htmlFor="name">Service name</label>
                <input id="name" className="input" {...register('name')} />
                {errors.name?.message !== undefined && (
                  <span className="field-error">{errors.name.message}</span>
                )}
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea id="description" className="textarea" {...register('description')} />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="price">Price</label>
                  <input
                    id="price"
                    className="input"
                    min="0.01"
                    step="0.01"
                    type="number"
                    {...register('price', { valueAsNumber: true })}
                  />
                  {errors.price?.message !== undefined && (
                    <span className="field-error">{errors.price.message}</span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="durationMinutes">Duration</label>
                  <select
                    id="durationMinutes"
                    className="select"
                    {...register('durationMinutes', { valueAsNumber: true })}
                  >
                    {[15, 30, 45, 60, 90, 120].map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="category">Category</label>
                <select id="category" className="select" {...register('category')}>
                  <option value="haircut">Haircut</option>
                  <option value="beard">Beard</option>
                  <option value="shave">Shave</option>
                  <option value="color">Color</option>
                  <option value="combo">Combo</option>
                  <option value="kids">Kids</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {editing !== null && (
                <label className="service-active-toggle">
                  <input
                    checked={serviceActive}
                    onChange={(event) => setServiceActive(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Active and bookable</strong>
                    <small>Turn this on to show the service to customers.</small>
                  </span>
                </label>
              )}
              <button className="button button-primary" disabled={save.isPending} type="submit">
                <Scissors size={17} />
                {save.isPending
                  ? imageFile === null
                    ? 'Saving...'
                    : 'Uploading image...'
                  : 'Save service'}
              </button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
