import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from './proxy';

const request = (path: string, cookie?: string): NextRequest =>
  new NextRequest(
    `http://localhost:3000${path}`,
    cookie === undefined ? {} : { headers: { cookie } },
  );

describe('role-aware route proxy', () => {
  it('sends unauthenticated dashboard visits to barber sign in', () => {
    const response = proxy(request('/dashboard/mobile-service'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login/barber?next=%2Fdashboard%2Fmobile-service',
    );
  });

  it('sends unauthenticated appointment visits to client sign in', () => {
    const response = proxy(request('/appointments'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login/client?next=%2Fappointments',
    );
  });

  it('rejects a client session from the barber dashboard', () => {
    const response = proxy(request('/dashboard', 'barber_access=token; cutg_role=CLIENT'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login/barber?next=%2Fdashboard',
    );
  });

  it('allows the matching role through', () => {
    const response = proxy(
      request('/dashboard/mobile-service', 'barber_access=token; cutg_role=BARBER'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
