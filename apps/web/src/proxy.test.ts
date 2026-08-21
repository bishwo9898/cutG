import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from './proxy';

const request = (path: string, cookie?: string): NextRequest =>
  new NextRequest(
    `http://localhost:3000${path}`,
    cookie === undefined ? {} : { headers: { cookie } },
  );

describe('dual portal proxy', () => {
  it('permanently redirects legacy route families', () => {
    const response = proxy(request('/dashboard/mobile-service?tab=area'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/barber/dashboard/mobile-service?tab=area',
    );
  });

  it('sends protected portal visits to the matching login', () => {
    expect(proxy(request('/barber/dashboard')).headers.get('location')).toBe(
      'http://localhost:3000/barber/login?next=%2Fbarber%2Fdashboard',
    );
    expect(proxy(request('/client/appointments')).headers.get('location')).toBe(
      'http://localhost:3000/client/login?next=%2Fclient%2Fappointments',
    );
    expect(proxy(request('/client/design/look-id')).headers.get('location')).toBe(
      'http://localhost:3000/client/login?next=%2Fclient%2Fdesign%2Flook-id',
    );
  });

  it('redirects authenticated users away from the wrong portal', () => {
    expect(
      proxy(request('/barber/dashboard', 'barber_access=token; cutg_role=CLIENT')).headers.get(
        'location',
      ),
    ).toBe('http://localhost:3000/client');
    expect(
      proxy(request('/client/barbers', 'barber_access=token; cutg_role=BARBER')).headers.get(
        'location',
      ),
    ).toBe('http://localhost:3000/barber/dashboard');
  });

  it('requires an account for discovery and allows matching protected sessions', () => {
    expect(proxy(request('/client/barbers')).headers.get('location')).toBe(
      'http://localhost:3000/client/login?next=%2Fclient%2Fbarbers',
    );
    expect(
      proxy(request('/barber/dashboard/mobile-service', 'barber_access=token; cutg_role=BARBER'))
        .status,
    ).toBe(200);
    expect(
      proxy(request('/client/design/look-id', 'barber_access=token; cutg_role=CLIENT')).status,
    ).toBe(200);
    expect(
      proxy(request('/client/barbers', 'barber_access=token; cutg_role=CLIENT')).status,
    ).toBe(200);
  });

  it('allows users to open the other role auth flow to switch accounts', () => {
    expect(proxy(request('/barber/login', 'barber_access=token; cutg_role=CLIENT')).status).toBe(
      200,
    );
    expect(proxy(request('/client/register', 'barber_access=token; cutg_role=BARBER')).status).toBe(
      200,
    );
  });

  it('ignores stale role metadata when no token session remains', () => {
    expect(proxy(request('/barber/login', 'cutg_role=CLIENT')).status).toBe(200);
    expect(proxy(request('/barber/dashboard', 'cutg_role=BARBER')).headers.get('location')).toBe(
      'http://localhost:3000/barber/login?next=%2Fbarber%2Fdashboard',
    );
  });
});
