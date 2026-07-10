import type { Request, Response } from 'express';

import { AppError } from '../middleware/errorHandler';
import { verifyStripeSignature } from '../services/payment/stripeService';
import { processStripeWebhookEvent } from '../services/payment/webhookService';

export const stripeWebhookHandler = async (request: Request, response: Response): Promise<void> => {
  const rawBody = Buffer.isBuffer(request.body)
    ? request.body
    : Buffer.from(JSON.stringify(request.body ?? {}));

  if (!verifyStripeSignature(rawBody, request.header('stripe-signature'))) {
    response.status(400).json({
      status: 'error',
      error: 'INVALID_SIGNATURE',
      code: 'INVALID_SIGNATURE',
      message: 'Invalid Stripe webhook signature.',
      statusCode: 400,
    });
    return;
  }

  try {
    const event = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      type: string;
      data?: { object?: Record<string, unknown> };
    };
    await processStripeWebhookEvent(event);
    response.json({ received: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      response.status(400).json({
        status: 'error',
        error: 'INVALID_WEBHOOK_PAYLOAD',
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Stripe webhook payload is invalid JSON.',
        statusCode: 400,
      });
      return;
    }
    throw new AppError(500, 'Stripe webhook processing failed.', 'WEBHOOK_PROCESSING_FAILED');
  }
};
