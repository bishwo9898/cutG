import { clerkMiddleware, createClerkClient } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

type PortalRole = 'BARBER' | 'CLIENT';

const legacyRoutes: Array<[string, string]> = [
  ['/dashboard', '/barber/dashboard'],
  ['/barbers', '/client/barbers'],
  ['/appointments', '/client/appointments'],
  ['/saved', '/client/saved'],
  ['/login/barber', '/barber/login'],
  ['/login/client', '/client/login'],
  ['/register/barber', '/barber/register'],
  ['/register/client', '/client/register'],
];

const redirectWithPath = (
  request: NextRequest,
  from: string,
  to: string,
  status = 307,
): NextResponse => {
  const target = request.nextUrl.clone();
  target.pathname = `${to}${request.nextUrl.pathname.slice(from.length)}`;
  return NextResponse.redirect(target, status);
};

export const roleFromPublicMetadata = (publicMetadata: unknown): PortalRole | null => {
  const value = (publicMetadata as { userType?: unknown } | null | undefined)?.userType;
  return value === 'BARBER' || value === 'CLIENT' ? value : null;
};

export const applyPortalRules = (
  request: NextRequest,
  hasSession: boolean,
  role: PortalRole | null,
): NextResponse => {
  const pathname = request.nextUrl.pathname;
  for (const [from, to] of legacyRoutes) {
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      return redirectWithPath(request, from, to, 308);
    }
  }

  const isAuthRoute =
    pathname === '/barber/login' ||
    pathname === '/barber/register' ||
    pathname === '/barber/forgot-password' ||
    pathname === '/client/login' ||
    pathname === '/client/register' ||
    pathname === '/client/forgot-password';

  if (hasSession && !isAuthRoute && role === 'BARBER' && pathname.startsWith('/client')) {
    return NextResponse.redirect(new URL('/barber/dashboard', request.url));
  }
  if (hasSession && !isAuthRoute && role === 'CLIENT' && pathname.startsWith('/barber')) {
    return NextResponse.redirect(new URL('/client', request.url));
  }

  const barberProtected =
    pathname === '/barber/dashboard' || pathname.startsWith('/barber/dashboard/');
  const clientProtected =
    pathname === '/client/barbers' ||
    pathname.startsWith('/client/barbers/') ||
    pathname === '/client/appointments' ||
    pathname.startsWith('/client/appointments/') ||
    pathname === '/client/design' ||
    pathname.startsWith('/client/design/') ||
    pathname === '/client/saved' ||
    pathname.startsWith('/client/profile');

  // A `role` of null means "unknown", not "wrong" — either the Clerk session token hasn't been
  // customized to include publicMetadata yet, or the /auth/sync claim hasn't propagated to this
  // session token. Only redirect when the role is affirmatively known and wrong; an authenticated
  // user with an unknown role is let through so the page (and the API's own DB-backed auth) can
  // decide, rather than bouncing a legitimately signed-in user out of their own portal.
  if (barberProtected && (!hasSession || role === 'CLIENT')) {
    const loginUrl = new URL('/barber/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (clientProtected && (!hasSession || role === 'BARBER')) {
    const loginUrl = new URL('/client/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
};

const clerkMiddlewareHandler = clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const role = roleFromPublicMetadata(sessionClaims?.publicMetadata);

  return applyPortalRules(request, userId !== null, role);
});

/**
 * `clerkMiddleware()` from @clerk/nextjs 7.8.2 does not yet work against Next.js 16's "Proxy"
 * convention under `next dev`: it re-invokes itself in a tight loop against the dev server's
 * internal request-forwarding until the connection is dropped ("socket hang up"). This reproduces
 * identically with webpack and Turbopack, with a bare `clerkMiddleware()` and no custom handler,
 * and under both the "proxy" and legacy "middleware" file conventions — it is a framework/SDK
 * incompatibility, not application code. Production builds are unaffected (confirmed working),
 * since this dev-server request-forwarding path doesn't exist there. In development only, talk to
 * Clerk's lower-level `authenticateRequest` primitive directly instead of the broken wrapper.
 */
const authenticateInDevelopment = async (request: NextRequest): Promise<NextResponse> => {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY ?? '',
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  });
  const requestState = await clerkClient.authenticateRequest(request);
  const auth = requestState.toAuth();
  const role = roleFromPublicMetadata(auth?.sessionClaims?.publicMetadata);

  return applyPortalRules(request, (auth?.userId ?? null) !== null, role);
};

export const proxy = async (
  request: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse | Response> => {
  if (process.env.NODE_ENV === 'development') {
    return authenticateInDevelopment(request);
  }

  const result = await clerkMiddlewareHandler(request, event);
  return result ?? NextResponse.next();
};

export const config = {
  matcher: [
    '/barber/:path*',
    '/client/:path*',
    '/dashboard/:path*',
    '/barbers/:path*',
    '/appointments/:path*',
    '/saved/:path*',
    '/login/:path*',
    '/register/:path*',
  ],
};
