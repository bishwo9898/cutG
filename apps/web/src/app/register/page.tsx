'use client';

import {
  PasswordSchema,
  RegisterRequestSchema,
  type RegisterRequest,
} from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

const schema = RegisterRequestSchema.extend({
  password: PasswordSchema,
});

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(schema),
    defaultValues: { userType: 'CLIENT' },
  });

  const submit = async (values: RegisterRequest): Promise<void> => {
    setError(null);
    const response = await fetch('/api/backend/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(body.message ?? 'We could not create your account.');
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">Start with cutG</span>
        <h1>Create your account</h1>
        <p className="subtitle">Join as a client to book, or as a barber to manage your shop.</p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {error !== null && <Notice>{error}</Notice>}
          <div className="form-row">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                className="input"
                autoComplete="given-name"
                {...register('firstName')}
              />
              {errors.firstName?.message !== undefined && (
                <span className="field-error">{errors.firstName.message}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                className="input"
                autoComplete="family-name"
                {...register('lastName')}
              />
              {errors.lastName?.message !== undefined && (
                <span className="field-error">{errors.lastName.message}</span>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            <span className="field-error">
              {errors.password?.message ?? 'Use at least 12 characters.'}
            </span>
          </div>
          <div className="field">
            <label htmlFor="userType">Account type</label>
            <select id="userType" className="select" {...register('userType')}>
              <option value="CLIENT">Client</option>
              <option value="BARBER">Barber</option>
            </select>
            {errors.userType?.message !== undefined && (
              <span className="field-error">{errors.userType.message}</span>
            )}
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-footer">
          Already have an account?{' '}
          <Link className="text-link" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
