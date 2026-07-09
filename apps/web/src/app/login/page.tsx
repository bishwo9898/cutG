'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
type FormValues = z.infer<typeof schema>;

function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const submit = async (values: FormValues): Promise<void> => {
    setError(null);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as { message?: string; user?: { userType?: string } };

    if (!response.ok) {
      setError(body.message ?? 'Sign in failed.');
      return;
    }

    if (body.user?.userType !== 'BARBER') {
      await fetch('/api/auth/logout', { method: 'POST' });
      setError('The barber dashboard is only available to barber accounts.');
      return;
    }

    router.push(searchParams.get('next') ?? '/dashboard');
    router.refresh();
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">Barber workspace</span>
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to manage your day, your way.</p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {error !== null && <Notice>{error}</Notice>}
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
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password?.message !== undefined && (
              <span className="field-error">{errors.password.message}</span>
            )}
          </div>
          <div className="split-link">
            <Link className="text-link" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            <LogIn size={17} />
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer">
          New to cutG?{' '}
          <Link className="text-link" href="/register">
            Create your workspace
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="spinner" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
