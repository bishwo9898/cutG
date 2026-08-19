import { beforeEach, describe, expect, it, vi } from 'vitest';

const smtpMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: smtpMocks.createTransport.mockReturnValue({
      sendMail: smtpMocks.sendMail,
    }),
  },
}));

vi.mock('../../config/env', () => ({
  env: {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 465,
    SMTP_SECURE: true,
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'test-app-password',
    EMAIL_FROM: 'sender@example.com',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { sendVerificationEmail } from './emailService';

describe('SMTP email delivery', () => {
  beforeEach(() => {
    smtpMocks.sendMail.mockReset();
  });

  it('uses the configured SMTP transport without logging the verification code', async () => {
    smtpMocks.sendMail.mockResolvedValue({ messageId: 'test-message', rejected: [] });

    await sendVerificationEmail({
      email: 'recipient@example.com',
      code: '123456',
      expiresAt: new Date('2026-08-19T12:00:00.000Z'),
    });

    expect(smtpMocks.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'sender@example.com',
        pass: 'test-app-password',
      },
    });
    expect(smtpMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'cutG', address: 'sender@example.com' },
        to: 'recipient@example.com',
        subject: 'Verify your cutG account',
      }),
    );
  });
});
