'use client';

import { useClerk } from '@clerk/nextjs';
import { useSignIn } from '@clerk/nextjs/legacy';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';
import { clerkErrorMessage } from '@/lib/clerk-error-message';

export default function ForgotPasswordPage(): React.ReactElement {
  const pathname = usePathname();
  const role = pathname.startsWith('/barber') ? 'barber' : 'client';
  const { isLoaded, signIn } = useSignIn();
  const clerk = useClerk();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!isLoaded) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (clerk.session !== null) {
        await clerk.signOut();
      }

      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setSent(true);
    } catch (submitError) {
      setError(clerkErrorMessage(submitError, 'We could not send a reset code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell audience={role === 'barber' ? 'BARBER' : 'CLIENT'}>
      <div className="auth-form">
        <span className="eyebrow">Account recovery</span>
        <h1>Reset your password</h1>
        <p className="subtitle">We will send reset instructions when the account exists.</p>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {sent && (
            <Notice tone="success">
              Check your inbox, then continue to the reset form with the code.
            </Notice>
          )}
          {error !== null && <Notice>{error}</Notice>}
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting || email.length === 0}
            type="submit"
          >
            <Send size={17} />
            {isSubmitting ? 'Sending...' : 'Send reset code'}
          </button>
        </form>
        <p className="auth-footer">
          {sent ? (
            <Link className="text-link" href={`/reset-password?role=${role}`}>
              Enter reset code
            </Link>
          ) : (
            <Link className="text-link" href={`/${role}/login`}>
              Return to sign in
            </Link>
          )}
        </p>
      </div>
    </AuthShell>
  );
}
