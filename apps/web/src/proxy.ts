import { type NextRequest, NextResponse } from 'next/server';

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

const roleOf = (request: NextRequest): PortalRole | null => {
  const value = request.cookies.get('cutg_role')?.value;
  return value === 'BARBER' || value === 'CLIENT' ? value : null;
};

export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  for (const [from, to] of legacyRoutes) {
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      return redirectWithPath(request, from, to, 308);
    }
  }

  const role = roleOf(request);
  const hasSession = request.cookies.has('barber_access') || request.cookies.has('barber_refresh');

  if (role === 'BARBER' && pathname.startsWith('/client')) {
    return NextResponse.redirect(new URL('/barber/dashboard', request.url));
  }
  if (role === 'CLIENT' && pathname.startsWith('/barber')) {
    return NextResponse.redirect(new URL('/client', request.url));
  }

  const barberProtected =
    pathname === '/barber/dashboard' || pathname.startsWith('/barber/dashboard/');
  const clientProtected =
    pathname === '/client/appointments' ||
    pathname.startsWith('/client/appointments/') ||
    pathname === '/client/saved' ||
    pathname.startsWith('/client/profile');

  if (barberProtected && (!hasSession || role !== 'BARBER')) {
    const loginUrl = new URL('/barber/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (clientProtected && (!hasSession || role !== 'CLIENT')) {
    const loginUrl = new URL('/client/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

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
