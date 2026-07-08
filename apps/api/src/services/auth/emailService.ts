import { logger } from '../../utils/logger';

type VerificationEmailInput = {
  email: string;
  code: string;
  expiresAt: Date;
};

type PasswordResetEmailInput = {
  email: string;
  code: string;
  expiresAt: Date;
};

export const sendVerificationEmail = (input: VerificationEmailInput): Promise<void> => {
  logger.info('Email verification placeholder generated', {
    email: input.email,
    verificationCode: input.code,
    expiresAt: input.expiresAt.toISOString(),
  });

  return Promise.resolve();
};

export const sendPasswordResetEmail = (input: PasswordResetEmailInput): Promise<void> => {
  logger.info('Password reset placeholder generated', {
    email: input.email,
    resetCode: input.code,
    expiresAt: input.expiresAt.toISOString(),
  });

  return Promise.resolve();
};
