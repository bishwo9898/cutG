import 'server-only';

import { auth } from '@clerk/nextjs/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

const parseBody = async (response: Response): Promise<unknown> =>
  response.json().catch(() => ({
    status: 'error',
    code: 'BAD_GATEWAY',
    message: 'The API returned an unreadable response.',
  }));

export const apiRequest = async (
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: unknown }> => {
  const { getToken } = await auth();
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const body = await parseBody(response);

  return { response, body };
};
