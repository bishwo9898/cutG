'use client';

import { ForgotPasswordRequestSchema, type ForgotPasswordRequest } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';


import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

export default function ForgotPasswordPage(): React.ReactElement {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequest>({ resolver: zodResolver(ForgotPasswordRequestSchema) });

  const submit = async (values: ForgotPasswordRequest): Promise<void> => {
    await fetch('/api/backend/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setSent(true);
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">Account recovery</span>
        <h1>Reset your password</h1>
        <p className="subtitle">We will send reset instructions when the account exists.</p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {sent && (
            <Notice tone="success">
              Check your inbox, then continue to the reset form with the code.
            </Notice>
          )}
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
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            <Send size={17} />
            {isSubmitting ? 'Sending...' : 'Send reset code'}
          </button>
        </form>
        <p className="auth-footer">
          {sent ? (
            <Link className="text-link" href="/reset-password">
              Enter reset code
            </Link>
          ) : (
            <Link className="text-link" href="/login">
              Return to sign in
            </Link>
          )}
        </p>
      </div>
    </AuthShell>
  );
}
