const enabled = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

export const mobileFeatures = {
  hairStudio: enabled(process.env.EXPO_PUBLIC_ENABLE_HAIR_STUDIO),
  earnings: enabled(process.env.EXPO_PUBLIC_ENABLE_EARNINGS),
  subscriptions: enabled(process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS),
} as const;
