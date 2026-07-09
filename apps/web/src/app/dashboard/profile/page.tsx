'use client';

import { ApiError } from '@barber-saas/api-client';
import { CreateBarberProfileSchema } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';


import { Notice } from '@/components/notice';
import { LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { BarberProfile } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

const schema = CreateBarberProfileSchema;
type FormValues = z.infer<typeof schema>;

export default function ProfilePage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const profile = useQuery({
    queryKey: ['barber-profile'],
    queryFn: () => browserApi.get<BarberProfile>('/barbers/me'),
    retry: false,
  });
  const missing =
    profile.error instanceof ApiError && profile.error.code === 'BARBER_PROFILE_NOT_FOUND';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (profile.data !== undefined) {
      reset({
        businessName: profile.data.businessName,
        bio: profile.data.bio ?? undefined,
        yearsOfExperience: profile.data.yearsOfExperience ?? undefined,
        address: profile.data.address ?? undefined,
        city: profile.data.city ?? undefined,
        state: profile.data.state ?? undefined,
        zipCode: profile.data.zipCode ?? undefined,
        latitude: profile.data.latitude ?? undefined,
        longitude: profile.data.longitude ?? undefined,
      });
    }
  }, [profile.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      missing
        ? browserApi.post<BarberProfile>('/barbers/me/profile', values)
        : browserApi.patch<BarberProfile>('/barbers/me/profile', values),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['barber-profile'] });
    },
  });

  if (profile.isPending) {
    return <LoadingState />;
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>{missing ? 'Create your profile' : 'Business profile'}</h1>
          <p>These details shape what clients see and where they find you.</p>
        </div>
      </div>
      <form className="panel" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="panel-header">
          <h2>Profile details</h2>
        </div>
        <div className="panel-body form-stack">
          {mutation.isError && <Notice>{errorMessage(mutation.error)}</Notice>}
          {saved && <Notice tone="success">Profile changes saved.</Notice>}
          <div className="field">
            <label htmlFor="businessName">Business name</label>
            <input id="businessName" className="input" {...register('businessName')} />
            {errors.businessName?.message !== undefined && (
              <span className="field-error">{errors.businessName.message}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="bio">About your work</label>
            <textarea id="bio" className="textarea" {...register('bio')} />
            {errors.bio?.message !== undefined && (
              <span className="field-error">{errors.bio.message}</span>
            )}
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="yearsOfExperience">Years of experience</label>
              <input
                id="yearsOfExperience"
                className="input"
                type="number"
                min={0}
                max={60}
                {...register('yearsOfExperience', {
                  setValueAs: (value: string) => (value === '' ? undefined : Number(value)),
                })}
              />
            </div>
            <div className="field">
              <label htmlFor="address">Street address</label>
              <input
                id="address"
                className="input"
                autoComplete="street-address"
                {...register('address')}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                className="input"
                autoComplete="address-level2"
                {...register('city')}
              />
            </div>
            <div className="field">
              <label htmlFor="state">State</label>
              <input
                id="state"
                className="input"
                autoComplete="address-level1"
                {...register('state')}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="zipCode">ZIP or postal code</label>
            <input
              id="zipCode"
              className="input"
              autoComplete="postal-code"
              {...register('zipCode')}
            />
          </div>
        </div>
        <div className="panel-header" style={{ justifyContent: 'flex-end' }}>
          <button className="button button-primary" disabled={mutation.isPending} type="submit">
            <Save size={17} />
            {mutation.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </main>
  );
}
