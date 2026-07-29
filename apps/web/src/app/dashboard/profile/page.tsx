'use client';

import { ApiError } from '@barber-saas/api-client';
import { CreateBarberProfileSchema } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  ShopLocationEditor,
  type ShopLocationValue,
} from '@/components/barber/shop-location-editor';
import { Notice } from '@/components/notice';
import { LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { BarberProfile } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

const schema = CreateBarberProfileSchema;
type FormValues = z.infer<typeof schema>;

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

export default function ProfilePage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [shopLocation, setShopLocation] = useState<ShopLocationValue | null>(null);
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
    setValue,
    watch,
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
      setShopLocation(shopLocationFor(profile.data));
    }
  }, [profile.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      missing
        ? browserApi.post<BarberProfile>('/barbers/me/profile', values)
        : browserApi.patch<BarberProfile>('/barbers/me/profile', values),
    onSuccess: async (updatedProfile) => {
      setShopLocation(shopLocationFor(updatedProfile));
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['barber-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-config'] }),
        queryClient.invalidateQueries({ queryKey: ['public-barber'] }),
      ]);
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
      {mutation.isError && <Notice>{errorMessage(mutation.error)}</Notice>}
      {saved && <Notice tone="success">Profile changes saved.</Notice>}
      <form
        className="profile-settings-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="profile-settings-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Profile details</h2>
                <p className="panel-description">How your business appears to clients.</p>
              </div>
            </div>
            <div className="panel-body form-stack">
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
            </div>
          </section>

          <ShopLocationEditor
            businessName={watch('businessName')}
            idPrefix="barber-profile-shop"
            onChange={(location) => {
              setSaved(false);
              setShopLocation(location);
              setValue('address', location.address, { shouldDirty: true });
              setValue('city', location.city, { shouldDirty: true });
              setValue('state', location.state, { shouldDirty: true });
              setValue('zipCode', location.zipCode, { shouldDirty: true });
              setValue('latitude', location.latitude, { shouldDirty: true });
              setValue('longitude', location.longitude, { shouldDirty: true });
            }}
            value={shopLocation}
          />
        </div>
        <div className="profile-save-bar">
          <button className="button button-primary" disabled={mutation.isPending} type="submit">
            <Save size={17} />
            {mutation.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </main>
  );
}
