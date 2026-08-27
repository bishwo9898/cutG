'use client';

import { useSignUp } from '@clerk/nextjs/legacy';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';
import { clerkErrorMessage } from '@/lib/clerk-error-message';

function VerifyEmailForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const role = searchParams.get('role') === 'barber' ? 'BARBER' : 'CLIENT';
  const next = searchParams.get('next');
  const { isLoaded, signUp, setActive } = useSignUp();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!isLoaded) {
      return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status !== 'complete' || result.createdSessionId === null) {
        setMessage({ tone: 'error', text: 'That code did not work. Please try again.' });
        return;
      }

      await setActive({ session: result.createdSessionId });

      const syncResponse = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: role }),
      });

      if (!syncResponse.ok) {
        setMessage({
          tone: 'error',
          text: 'Email verified, but we could not finish setting up your account. Try signing in.',
        });
        return;
      }

      const portalPrefix = role === 'BARBER' ? '/barber' : '/client';
      const destination =
        next?.startsWith(portalPrefix) === true
          ? next
          : role === 'BARBER'
            ? '/barber/dashboard'
            : '/client';
      window.location.assign(destination);
    } catch (error) {
      setMessage({ tone: 'error', text: clerkErrorMessage(error, 'Verification failed.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async (): Promise<void> => {
    if (!isLoaded) {
      return;
    }
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMessage({ tone: 'success', text: 'A fresh code is on its way.' });
    } catch {
      setMessage({ tone: 'error', text: 'We could not resend the code.' });
    }
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">One quick check</span>
        <h1>Verify your email</h1>
        <p className="subtitle">
          Enter the six-digit code sent to {email !== '' ? email : 'your email address'}.
        </p>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {message !== null && <Notice tone={message.tone}>{message.text}</Notice>}
          <div className="field">
            <label htmlFor="verificationCode">Verification code</label>
            <input
              id="verificationCode"
              className="input"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting || code.length === 0}
            type="submit"
          >
            <MailCheck size={17} />
            {isSubmitting ? 'Verifying...' : 'Verify email'}
          </button>
          <button className="button button-ghost" onClick={() => void resend()} type="button">
            Send a new code
          </button>
        </form>
        <p className="auth-footer">
          <Link
            className="text-link"
            href={`/${role === 'BARBER' ? 'barber' : 'client'}/login${next === null ? '' : `?next=${encodeURIComponent(next)}`}`}
          >
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
