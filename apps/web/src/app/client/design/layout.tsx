'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { hasAiStudioAccess } from '@/lib/features';

/**
 * AI Hair Studio is still in progress, so its entry points are hidden from ordinary accounts.
 * Guarding the routes here as well means a bookmark or a pasted link cannot drop somebody into a
 * half-built flow — it covers both /client/design and /client/design/[designId].
 */
export default function ClientDesignLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement | null {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const allowed = hasAiStudioAccess(user?.publicMetadata);

  useEffect(() => {
    if (isLoaded && !allowed) {
      router.replace('/client');
    }
  }, [allowed, isLoaded, router]);

  if (!isLoaded || !allowed) {
    return null;
  }

  return <>{children}</>;
}
