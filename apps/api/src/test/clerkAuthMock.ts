import { vi } from 'vitest';

/**
 * Integration tests never talk to real Clerk infrastructure. `createVerifiedUser` (see
 * fixtures.ts) inserts a `users` row with a fake `clerk_user_id` and tests authenticate by
 * sending that id verbatim as the bearer token — this mock treats the bearer token as the
 * Clerk user id instead of verifying a real session JWT.
 */
vi.mock('@clerk/express', () => ({
  clerkMiddleware:
    () =>
    (_request: unknown, _response: unknown, next: () => void): void =>
      next(),
  getAuth: (request: { header: (name: string) => string | undefined }): { userId: string | null } => {
    const header = request.header('authorization');
    const userId = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    return { userId };
  },
}));
