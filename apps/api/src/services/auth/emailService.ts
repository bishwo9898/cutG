import { env } from '../../config/env';
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

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

const sendWithSendGrid = async (message: EmailMessage): Promise<void> => {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: { email: env.EMAIL_FROM, name: 'cutG' },
      subject: message.subject,
      content: [{ type: 'text/plain', value: message.text }],
    }),
  });

  if (response.status !== 202) {
    const providerRequestId = response.headers.get('x-message-id');
    logger.error('SendGrid rejected an email request', undefined, {
      status: response.status,
      providerRequestId,
    });
    throw new Error('The email provider rejected the request.');
  }
};

const deliver = async (message: EmailMessage, developmentCode: string): Promise<void> => {
  if (env.EMAIL_PROVIDER === 'sendgrid') {
    await sendWithSendGrid(message);
    return;
  }

  // Codes are useful in local development, but must never be written to production logs.
  logger.info('Email delivery is using the log provider', {
    email: message.to,
    ...(env.NODE_ENV === 'production' ? {} : { developmentCode }),
  });
};

export const sendVerificationEmail = (input: VerificationEmailInput): Promise<void> =>
  deliver(
    {
      to: input.email,
      subject: 'Verify your cutG account',
      text: [
        'Welcome to cutG.',
        '',
        `Your verification code is: ${input.code}`,
        `This code expires at ${input.expiresAt.toISOString()}.`,
        '',
        'If you did not create this account, you can ignore this email.',
      ].join('\n'),
    },
    input.code,
  );

export const sendPasswordResetEmail = (input: PasswordResetEmailInput): Promise<void> =>
  deliver(
    {
      to: input.email,
      subject: 'Reset your cutG password',
      text: [
        'A password reset was requested for your cutG account.',
        '',
        `Your reset code is: ${input.code}`,
        `This code expires at ${input.expiresAt.toISOString()}.`,
        '',
        'If you did not request this reset, you can ignore this email.',
      ].join('\n'),
    },
    input.code,
  );
