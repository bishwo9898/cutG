'use client';

import { ResetPasswordRequestSchema, type ResetPasswordRequest } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

export default function ResetPasswordPage(): React.ReactElement {
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordRequest>({ resolver: zodResolver(ResetPasswordRequestSchema) });

  const submit = async (values: ResetPasswordRequest): Promise<void> => {
    const response = await fetch('/api/backend/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as { message?: string };
    setMessage({
      tone: response.ok ? 'success' : 'error',
      text: response.ok
        ? 'Password updated. You can sign in now.'
        : (body.message ?? 'Reset failed.'),
    });
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">Choose a new password</span>
        <h1>Back in control</h1>
        <p className="subtitle">
          Enter the reset code and a new password of at least 12 characters.
        </p>
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
            <label htmlFor="resetCode">Reset code</label>
            <input id="resetCode" className="input" {...register('resetCode')} />
            {errors.resetCode?.message !== undefined && (
              <span className="field-error">{errors.resetCode.message}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              className="input"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            {errors.newPassword?.message !== undefined && (
              <span className="field-error">{errors.newPassword.message}</span>
            )}
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            <KeyRound size={17} />
            {isSubmitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <p className="auth-footer">
          <Link className="text-link" href="/login">
            Return to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
