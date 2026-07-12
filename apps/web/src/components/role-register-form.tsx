'use client';

import { PasswordSchema, RegisterRequestSchema } from '@barber-saas/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthShell } from '@/components/auth-shell';
import { Notice } from '@/components/notice';

type AuthRole = 'CLIENT' | 'BARBER';
const schema = RegisterRequestSchema.extend({
  password: PasswordSchema,
  confirmPassword: z.string(),
  acceptedTerms: z.boolean(),
}).superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Passwords must match.',
    });
  }
  if (value.userType === 'BARBER' && !value.acceptedTerms) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['acceptedTerms'],
      message: 'Accept the Barber Terms to continue.',
    });
  }
});
type FormValues = z.infer<typeof schema>;

export function RoleRegisterForm({ role }: { role: AuthRole }): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isBarber = role === 'BARBER';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { userType: role, confirmPassword: '', acceptedTerms: false },
  });

  const submit = async (values: FormValues): Promise<void> => {
    setError(null);
    const response = await fetch('/api/backend/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
        userType: role,
      }),
    });
    const body = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(body.message ?? 'We could not create your account.');
      return;
    }
    router.push(
      `/verify-email?email=${encodeURIComponent(values.email)}&role=${role.toLowerCase()}`,
    );
  };

  return (
    <AuthShell audience={role}>
      <div className="auth-form">
        <span className="eyebrow">{isBarber ? 'Build your business' : 'Start booking'}</span>
        <h1>{isBarber ? 'Create a barber account' : 'Create a client account'}</h1>
        <p className="subtitle">
          {isBarber ? 'Set up your workspace and services.' : 'Save barbers and book appointments.'}
        </p>
        <form className="form-stack" onSubmit={handleSubmit(submit)}>
          {error !== null && <Notice>{error}</Notice>}
          <input type="hidden" value={role} {...register('userType')} />
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
          {errors.acceptedTerms?.message !== undefined && (
            <span className="field-error">{errors.acceptedTerms.message}</span>
          )}
          <div className="field">
            <label htmlFor={`${role}-register-password`}>Password</label>
            <input
              id={`${role}-register-password`}
              className="input"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            <span className="field-error">
              {errors.password?.message ?? 'Use at least 12 characters.'}
            </span>
          </div>
          <button
            className="button button-primary button-full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? 'Creating account...'
              : `Create ${isBarber ? 'barber' : 'client'} account`}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-switcher">
          <span>{isBarber ? 'Need a client account?' : 'Joining as a barber?'}</span>
          <Link className="text-link" href={isBarber ? '/client/register' : '/barber/register'}>
            Switch account type
          </Link>
        </div>
        <p className="auth-footer">
          Already have an account?{' '}
          <Link className="text-link" href={isBarber ? '/barber/login' : '/client/login'}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
