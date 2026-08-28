'use client';

import { useClerk } from '@clerk/nextjs';
import { useSignUp } from '@clerk/nextjs/legacy';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';
import { clerkErrorMessage } from '@/lib/clerk-error-message';

type AuthRole = 'CLIENT' | 'BARBER';

const PasswordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(72, 'Password must contain at most 72 characters.');

const schema = z
  .object({
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    password: PasswordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords must match.',
      });
    }
  });
type FormValues = z.infer<typeof schema>;

export function RoleRegisterForm({ role }: { role: AuthRole }): React.ReactElement {
  const { isLoaded, signUp } = useSignUp();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const isBarber = role === 'BARBER';
  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get('next'));
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { confirmPassword: '', acceptedTerms: false },
  });

  const submit = async (values: FormValues): Promise<void> => {
    setError(null);
    if (!isLoaded) {
      return;
    }
    if (isBarber && !values.acceptedTerms) {
      setError('Accept the Barber Terms to continue.');
      return;
    }
    try {
      if (clerk.session !== null) {
        await clerk.signOut();
      }

      await signUp.create({
        emailAddress: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      const query = new URLSearchParams({ email: values.email, role: role.toLowerCase() });
      if (next?.startsWith(isBarber ? '/barber' : '/client') === true) {
        query.set('next', next);
      }
      window.location.assign(`/verify-email?${query.toString()}`);
    } catch (submitError) {
      setError(clerkErrorMessage(submitError, 'We could not create your account.'));
    }
  };

  return (
    <AuthShell audience={role}>
      <div className="auth-form">
        <span className="eyebrow">{isBarber ? 'Build your business' : 'Start booking'}</span>
        <h1>{isBarber ? 'Create a barber account' : 'Create a customer account'}</h1>
        <p className="subtitle">
          {isBarber ? 'Set up your workspace and services.' : 'Save barbers and book appointments.'}
        </p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {error !== null && <Notice>{error}</Notice>}
          <div className="form-row">
            <div className="field">
              <label htmlFor={`${role}-firstName`}>First name</label>
              <input
                id={`${role}-firstName`}
                className="input"
                autoComplete="given-name"
                {...register('firstName')}
              />
              {errors.firstName?.message !== undefined && (
                <span className="field-error">{errors.firstName.message}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${role}-lastName`}>Last name</label>
              <input
                id={`${role}-lastName`}
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
            <label htmlFor={`${role}-register-email`}>Email address</label>
            <input
              id={`${role}-register-email`}
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
            <label htmlFor={`${role}-register-password`}>Password</label>
            <input
              id={`${role}-register-password`}
              className="input"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password?.message !== undefined ? (
              <span className="field-error">{errors.password.message}</span>
            ) : (
              <span className="field-help">Use at least 12 characters.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${role}-confirm-password`}>Confirm password</label>
            <input
              id={`${role}-confirm-password`}
              className="input"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword?.message !== undefined && (
              <span className="field-error">{errors.confirmPassword.message}</span>
            )}
          </div>
          {isBarber && (
            <label className="checkbox-row">
              <input type="checkbox" {...register('acceptedTerms')} />I agree to the cutG Barber
              Terms of Service.
            </label>
          )}
          <div id="clerk-captcha" />
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? 'Creating account...'
              : `Create ${isBarber ? 'barber' : 'customer'} account`}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-switcher">
          <span>{isBarber ? 'Need a customer account?' : 'Joining as a barber?'}</span>
          <Link className="text-link" href={isBarber ? '/client/register' : '/barber/register'}>
            Switch account type
          </Link>
        </div>
        <p className="auth-footer">
          Already have an account?{' '}
          <Link
            className="text-link"
            href={`${isBarber ? '/barber/login' : '/client/login'}${next === null ? '' : `?next=${encodeURIComponent(next)}`}`}
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
