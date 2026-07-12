'use client';

import { VerifyEmailRequestSchema, type VerifyEmailRequest } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

function VerifyEmailForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const role = searchParams.get('role') === 'barber' ? 'barber' : 'client';
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailRequest>({
    resolver: zodResolver(VerifyEmailRequestSchema),
    defaultValues: { email },
  });

  const submit = async (values: VerifyEmailRequest): Promise<void> => {
    const response = await fetch('/api/backend/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as { message?: string };
    setMessage({
      tone: response.ok ? 'success' : 'error',
      text: response.ok
        ? 'Email verified. You can sign in now.'
        : (body.message ?? 'Verification failed.'),
    });
  };

  const resend = async (): Promise<void> => {
    const response = await fetch('/api/backend/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setMessage({
      tone: response.ok ? 'success' : 'error',
      text: response.ok ? 'A fresh code is on its way.' : 'We could not resend the code.',
    });
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">One quick check</span>
        <h1>Verify your email</h1>
        <p className="subtitle">Enter the six-digit code sent to your email address.</p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {message !== null && <Notice tone={message.tone}>{message.text}</Notice>}
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" className="input" type="email" {...register('email')} />
            {errors.email?.message !== undefined && (
              <span className="field-error">{errors.email.message}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="verificationCode">Verification code</label>
            <input
              id="verificationCode"
              className="input"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              {...register('verificationCode')}
            />
            {errors.verificationCode?.message !== undefined && (
              <span className="field-error">{errors.verificationCode.message}</span>
            )}
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            <MailCheck size={17} />
            {isSubmitting ? 'Verifying...' : 'Verify email'}
          </button>
          <button className="button button-ghost" onClick={resend} type="button">
            Send a new code
          </button>
        </form>
        <p className="auth-footer">
          <Link className="text-link" href={`/${role}/login`}>
            Return to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="spinner" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
