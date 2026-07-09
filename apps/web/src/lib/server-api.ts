import 'server-only';

import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const ACCESS_COOKIE = 'barber_access';
const REFRESH_COOKIE = 'barber_refresh';

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: unknown;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const parseBody = async (response: Response): Promise<unknown> =>
  response.json().catch(() => ({
    status: 'error',
    code: 'BAD_GATEWAY',
    message: 'The API returned an unreadable response.',
  }));

export const apiRequest = async (
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<{ response: Response; body: unknown }> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken !== undefined) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  let body = await parseBody(response);

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();

    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
      });
      body = await parseBody(response);
    }
  }

  return { response, body };
};

export const createSession = async (
  input: unknown,
): Promise<{ response: Response; body: unknown }> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body = await parseBody(response);

  if (response.ok) {
    const tokens = body as TokenPair;
    const cookieStore = await cookies();
    cookieStore.set(ACCESS_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: tokens.expiresIn,
    });
    cookieStore.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60,
    });

    return {
      response,
      body: { user: tokens.user, expiresIn: tokens.expiresIn },
    };
  }

  return { response, body };
};

export const refreshSession = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken === undefined) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) {
    cookieStore.delete(ACCESS_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
    return null;
  }

  const body = (await response.json()) as { accessToken: string; expiresIn: number };
  cookieStore.set(ACCESS_COOKIE, body.accessToken, {
    ...cookieOptions,
    maxAge: body.expiresIn,
  });
  return body.accessToken;
};

export const clearSession = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
};
