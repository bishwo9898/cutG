'use client';

import { useClerk } from '@clerk/nextjs';
import { useSignIn } from '@clerk/nextjs/legacy';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';
import { clerkErrorMessage } from '@/lib/clerk-error-message';

export default function ResetPasswordPage(): React.ReactElement {
  const { isLoaded, signIn, setActive } = useSignIn();
  const clerk = useClerk();
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });

      if (result.status !== 'complete' || result.createdSessionId === null) {
        setMessage({ tone: 'error', text: 'That code did not work. Please try again.' });
        return;
      }

      await setActive({ session: result.createdSessionId });
      setMessage({ tone: 'success', text: 'Password updated. Redirecting...' });

      const userType = clerk.user?.publicMetadata?.userType;
      window.location.assign(
        userType === 'BARBER' ? '/barber/dashboard' : userType === 'CLIENT' ? '/client' : '/login',
      );
    } catch (error) {
      setMessage({ tone: 'error', text: clerkErrorMessage(error, 'Reset failed.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <span className="eyebrow">Choose a new password</span>
        <h1>Back in control</h1>
        <p className="subtitle">
          Enter the reset code and a new password of at least 12 characters.
        </p>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {message !== null && <Notice tone={message.tone}>{message.text}</Notice>}
          <div className="field">
            <label htmlFor="resetCode">Reset code</label>
            <input
              id="resetCode"
              className="input"
              value={resetCode}
              onChange={(event) => setResetCode(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting || resetCode.length === 0 || newPassword.length < 12}
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
