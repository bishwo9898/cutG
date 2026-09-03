import { describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiTimeoutError } from '@barber-saas/api-client';

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: (): Promise<unknown> => Promise.resolve(body),
  }) as unknown as Response;

/**
 * Covers the shared ApiClient rather than mobile code, but lives here because this is the consumer
 * that depends on the guarantee — a phone on a flaky network — and api-client has no test runner
 * of its own.
 */
describe('ApiClient timeouts', () => {
  it('does not time out when none is configured, preserving existing behaviour', async () => {
    const fetchMock = vi.fn((): Promise<Response> => Promise.resolve(jsonResponse({ ok: true })));
    const client = new ApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    await expect(client.get('/thing')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('resolves normally when the request beats the timeout', async () => {
    const client = new ApiClient({
      baseUrl: 'http://api.test',
      timeoutMs: 1_000,
      fetch: (): Promise<Response> => Promise.resolve(jsonResponse({ ok: true })),
    });

    await expect(client.get('/thing')).resolves.toEqual({ ok: true });
  });

  it('rejects with ApiTimeoutError when the response never arrives', async () => {
    const client = new ApiClient({
      baseUrl: 'http://api.test',
      timeoutMs: 20,
      fetch: (): Promise<Response> => new Promise<Response>(() => {}),
    });

    await expect(client.get('/thing')).rejects.toBeInstanceOf(ApiTimeoutError);
  });

  it('times out a stalled header resolver, not just a stalled fetch', async () => {
    // The real failure: the header callback fetches an auth token, that refresh stalls, and fetch
    // is never reached. An AbortSignal passed to fetch alone would never fire here, so the app
    // sat on a spinner indefinitely and every later request queued behind it.
    const fetchMock = vi.fn((): Promise<Response> => Promise.resolve(jsonResponse({ ok: true })));
    const client = new ApiClient({
      baseUrl: 'http://api.test',
      timeoutMs: 20,
      headers: (): Promise<Record<string, string>> => new Promise<Record<string, string>>(() => {}),
      fetch: fetchMock,
    });

    await expect(client.get('/thing')).rejects.toBeInstanceOf(ApiTimeoutError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the configured duration so the cause is obvious', async () => {
    const client = new ApiClient({
      baseUrl: 'http://api.test',
      timeoutMs: 25,
      fetch: (): Promise<Response> => new Promise<Response>(() => {}),
    });

    await expect(client.get('/thing')).rejects.toMatchObject({ timeoutMs: 25 });
  });

  it('aborts the in-flight request rather than leaving it running', async () => {
    let seenSignal: AbortSignal | undefined;
    const client = new ApiClient({
      baseUrl: 'http://api.test',
      timeoutMs: 20,
      fetch: ((_url: string, init: RequestInit): Promise<Response> => {
        seenSignal = init.signal ?? undefined;
        return new Promise<Response>(() => {});
      }) as unknown as typeof fetch,
    });

    await expect(client.get('/thing')).rejects.toBeInstanceOf(ApiTimeoutError);
    expect(seenSignal?.aborted).toBe(true);
  });
});
