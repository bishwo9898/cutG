import 'server-only';

import { auth, createClerkClient } from '@clerk/nextjs/server';
import { headers } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

const parseBody = async (response: Response): Promise<unknown> =>
  response.json().catch(() => ({
    status: 'error',
    code: 'BAD_GATEWAY',
    message: 'The API returned an unreadable response.',
  }));

/**
 * `auth()` requires clerkMiddleware() to have run first, since it reads auth state the middleware
 * computed and forwarded on the request. See proxy.ts for why clerkMiddleware() is bypassed in
 * development (it doesn't work under Next.js 16's dev server) — that means `auth()` isn't usable
 * here in development either, so re-authenticate the request directly instead, exactly like
 * proxy.ts's own development branch does.
 */
const getSessionToken = async (): Promise<string | null> => {
  if (process.env.NODE_ENV === 'development') {
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
    });
    const request = new Request('http://localhost/', { headers: await headers() });
    const requestState = await clerkClient.authenticateRequest(request);
    const token = await requestState.toAuth()?.getToken();
    return token ?? null;
  }

  const { getToken } = await auth();
  return getToken();
};

export const apiRequest = async (
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: unknown }> => {
  const token = await getSessionToken();
  const headerBag = new Headers(init.headers);
  headerBag.set('Accept', 'application/json');

  if (init.body !== undefined && !headerBag.has('Content-Type')) {
    headerBag.set('Content-Type', 'application/json');
  }

  if (token !== null) {
    headerBag.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: headerBag,
    cache: 'no-store',
  });
  const body = await parseBody(response);

  return { response, body };
};
