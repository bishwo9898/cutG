import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { TIER_RANK, type SubscriptionTierName } from '../config/subscriptionTiers';
import { query } from '../db/queries/barber.queries';
import type { AuthenticatedRequest } from '../types/auth';

export const requireSubscriptionTier =
  (minimumTier: Exclude<SubscriptionTierName, 'FREE'>): RequestHandler =>
  async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const auth = (request as AuthenticatedRequest).auth;
    const rows = await query<{ subscription_tier: SubscriptionTierName }>(
      'SELECT subscription_tier FROM barber_profiles WHERE user_id = $1',
      [auth.id],
    );
    const currentTier = rows[0]?.subscription_tier ?? 'FREE';

    if (TIER_RANK[currentTier] < TIER_RANK[minimumTier]) {
      response.status(403).json({
        status: 'error',
        error: 'SUBSCRIPTION_REQUIRED',
        code: 'SUBSCRIPTION_REQUIRED',
        message: `This feature requires ${minimumTier} tier or higher.`,
        requiredTier: minimumTier,
        currentTier,
        upgradeUrl: '/barbers/me/subscription/checkout',
        statusCode: 403,
      });
      return;
    }

    next();
  };
