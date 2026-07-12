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

  it('allows public discovery and matching protected sessions', () => {
    expect(proxy(request('/client/barbers')).status).toBe(200);
    expect(
      proxy(request('/barber/dashboard/mobile-service', 'barber_access=token; cutg_role=BARBER'))
        .status,
    ).toBe(200);
  });
});
