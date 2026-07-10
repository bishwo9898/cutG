export const SUBSCRIPTION_TIERS = {
  FREE: {
    maxServices: 5,
    maxSlotDaysAhead: 14,
    advancedAnalytics: false,
    aiRecommendations: false,
    prioritySearch: false,
    customBookingLink: false,
    clientMessaging: false,
  },
  BASIC: {
    maxServices: 20,
    maxSlotDaysAhead: 60,
    advancedAnalytics: false,
    aiRecommendations: false,
    prioritySearch: true,
    customBookingLink: true,
    clientMessaging: false,
  },
  PREMIUM: {
    maxServices: Infinity,
    maxSlotDaysAhead: 365,
    advancedAnalytics: true,
    aiRecommendations: true,
    prioritySearch: true,
    customBookingLink: true,
    clientMessaging: true,
  },
} as const;

export type SubscriptionTierName = keyof typeof SUBSCRIPTION_TIERS;

export const TIER_RANK: Record<SubscriptionTierName, number> = {
  FREE: 0,
  BASIC: 1,
  PREMIUM: 2,
};

export const publicFeaturesForTier = (
  tier: SubscriptionTierName,
): Record<string, boolean | number> => {
  const features = SUBSCRIPTION_TIERS[tier];
  return {
    maxServices: Number.isFinite(features.maxServices) ? features.maxServices : -1,
    maxSlotDaysAhead: features.maxSlotDaysAhead,
    advancedAnalytics: features.advancedAnalytics,
    aiRecommendations: features.aiRecommendations,
    prioritySearch: features.prioritySearch,
    customBookingLink: features.customBookingLink,
    clientMessaging: features.clientMessaging,
  };
};
