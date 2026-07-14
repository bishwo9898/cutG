'use client';

import { CreateServiceSchema } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Pencil, Plus, Scissors, Trash2, X } from 'lucide-react';
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

export default function ServicesPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BarberService | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<ServiceCategory>('haircut');
  const [visibleCategory, setVisibleCategory] = useState<ServiceCategory | 'all'>('all');
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
    } else {
      reset({ name: '', description: '', price: 0, durationMinutes: 30, category: createCategory });
    }
  }, [createCategory, editing, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing === null
        ? browserApi.post<BarberService>('/barbers/me/services', values)
        : browserApi.patch<BarberService>(`/barbers/me/services/${editing.id}`, values),
    onSuccess: async () => {
      setDrawerOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => browserApi.delete(`/barbers/me/services/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  const openCreate = (category: ServiceCategory = 'haircut'): void => {
    setCreateCategory(category);
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (service: BarberService): void => {
    setEditing(service);
    setDrawerOpen(true);
  };

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
            detail="Add the cuts and treatments clients can book."
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
          <nav className="service-category-pills" aria-label="Service categories">
            <button
              className={visibleCategory === 'all' ? 'is-active' : ''}
              onClick={() => setVisibleCategory('all')}
              type="button"
            >
              All {services.data.services.filter((service) => service.isActive).length}
            </button>
            {categories.map((category) => (
              <button
                className={visibleCategory === category.value ? 'is-active' : ''}
                key={category.value}
                onClick={() => setVisibleCategory(category.value)}
                type="button"
              >
                {category.label}{' '}
                {
                  services.data.services.filter(
                    (service) => service.isActive && service.category === category.value,
                  ).length
                }
              </button>
            ))}
          </nav>
          <div className="categorized-services">
            {categories
              .filter((category) => visibleCategory === 'all' || visibleCategory === category.value)
              .map((category) => {
                const items = services.data.services.filter(
                  (service) => service.isActive && service.category === category.value,
                );
                return (
                  <section
                    className="service-category-section"
                    id={`services-${category.value}`}
                    key={category.value}
                  >
                    <div className="service-category-heading">
                      <div>
                        <h2>{category.label}</h2>
                        <span>{items.length} active</span>
                      </div>
                      <button
                        className="button button-ghost"
                        onClick={() => openCreate(category.value)}
                        type="button"
                      >
                        <Plus size={15} /> Add {category.label.toLowerCase()}
                      </button>
                    </div>
                    {items.length === 0 ? (
                      <p className="empty-category-copy">
                        No {category.label.toLowerCase()} services yet.
                      </p>
                    ) : (
                      items.map((service) => (
                        <article className="service-menu-row" key={service.id}>
                          <div>
                            <strong>{service.name}</strong>
                            <span>{service.description ?? 'No description added yet.'}</span>
                          </div>
                          <span>{service.durationMinutes} min</span>
                          <strong>${service.price.toFixed(2)}</strong>
                          <span className="badge badge-success">Active</span>
                          <div className="service-row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${service.name}`}
                              onClick={() => openEdit(service)}
                              type="button"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Deactivate ${service.name}`}
                              disabled={deactivate.isPending}
                              onClick={() => deactivate.mutate(service.id)}
                              type="button"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </section>
                );
              })}
            {services.data.services.some((service) => !service.isActive) && (
              <details className="inactive-services">
                <summary>
                  <ChevronDown size={16} /> Inactive services (
                  {services.data.services.filter((service) => !service.isActive).length})
                </summary>
                {services.data.services
                  .filter((service) => !service.isActive)
                  .map((service) => (
                    <button key={service.id} onClick={() => openEdit(service)} type="button">
                      <span>{service.name}</span>
                      <small>
                        {service.category} · ${service.price.toFixed(2)}
                      </small>
                    </button>
                  ))}
              </details>
            )}
          </div>
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
              <button className="button button-primary" disabled={save.isPending} type="submit">
                <Scissors size={17} />
                {save.isPending ? 'Saving...' : 'Save service'}
              </button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
