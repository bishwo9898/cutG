import { useUser } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

import { hasAiStudioAccess } from '@/lib/features';

/**
 * AI Hair Studio is still being built, so its entry point is hidden unless the account is flagged
 * for it. Guarding the route group as well means a deep link or a restored navigation state cannot
 * drop somebody into a half-built flow — the same guard the web app applies at /client/design.
 */
export default function DesignLayout(): React.ReactElement | null {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return null;
  }

  if (!hasAiStudioAccess(user?.publicMetadata)) {
    return <Redirect href="/(client)/discover" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
