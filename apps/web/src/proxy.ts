import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest): NextResponse {
  const role = request.cookies.get('cutg_role')?.value;
  const isBarberRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const loginPath = isBarberRoute ? '/login/barber' : '/login/client';
  if (!request.cookies.has('barber_access') && !request.cookies.has('barber_refresh')) {
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((isBarberRoute && role !== 'BARBER') || (!isBarberRoute && role !== 'CLIENT')) {
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/appointments/:path*', '/saved/:path*'],
};
