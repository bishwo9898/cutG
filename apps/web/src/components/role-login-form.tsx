'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BriefcaseBusiness, LogIn, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

type AuthRole = 'CLIENT' | 'BARBER';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
type FormValues = z.infer<typeof schema>;

export function RoleLoginForm({ role }: { role: AuthRole }): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isBarber = role === 'BARBER';

  const submit = async (values: FormValues): Promise<void> => {
    setError(null);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, expectedUserType: role }),
    });
    const body = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(body.message ?? 'Sign in failed.');
      return;
    }
    router.push(searchParams.get('next') ?? (isBarber ? '/barber/dashboard' : '/client'));
    router.refresh();
  };

  return (
    <AuthShell audience={role}>
      <div className="auth-form">
        <span className="auth-role-icon" aria-hidden="true">
          {isBarber ? <BriefcaseBusiness size={20} /> : <Search size={20} />}
        </span>
        <span className="eyebrow">{isBarber ? 'Barber workspace' : 'Client booking'}</span>
        <h1>{isBarber ? 'Barber sign in' : 'Client sign in'}</h1>
        <p className="subtitle">
          {isBarber ? 'Manage your schedule and business.' : 'Find and manage your appointments.'}
        </p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {error !== null && <Notice>{error}</Notice>}
          <div className="field">
            <label htmlFor={`${role}-email`}>Email address</label>
            <input
              id={`${role}-email`}
              className="input"
              type="email"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email?.message !== undefined && (
              <span className="field-error">{errors.email.message}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${role}-password`}>Password</label>
            <input
              id={`${role}-password`}
              className="input"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password?.message !== undefined && (
              <span className="field-error">{errors.password.message}</span>
            )}
          </div>
          <div className="split-link">
            <Link
              className="text-link"
              href={isBarber ? '/barber/forgot-password' : '/client/forgot-password'}
            >
              Forgot password?
            </Link>
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            <LogIn size={17} />
            {isSubmitting ? 'Signing in...' : `Sign in as ${isBarber ? 'barber' : 'client'}`}
          </button>
        </form>
        <div className="auth-switcher">
          <span>{isBarber ? 'Looking for a barber?' : 'Running a barber business?'}</span>
          <Link className="text-link" href={isBarber ? '/client/login' : '/barber/login'}>
            {isBarber ? 'Client sign in' : 'Barber sign in'}
          </Link>
        </div>
        <p className="auth-footer">
          New to cutG?{' '}
          <Link className="text-link" href={isBarber ? '/barber/register' : '/client/register'}>
            Create your account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
