import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { applyPortalRules, roleFromPublicMetadata } from './proxy';

const request = (path: string): NextRequest => new NextRequest(`http://localhost:3000${path}`);

describe('roleFromPublicMetadata', () => {
  it('reads a valid role and rejects anything else', () => {
    expect(roleFromPublicMetadata({ userType: 'BARBER' })).toBe('BARBER');
    expect(roleFromPublicMetadata({ userType: 'CLIENT' })).toBe('CLIENT');
    expect(roleFromPublicMetadata({ userType: 'ADMIN' })).toBeNull();
    expect(roleFromPublicMetadata(undefined)).toBeNull();
    expect(roleFromPublicMetadata(null)).toBeNull();
  });
});

describe('dual portal proxy rules', () => {
  it('permanently redirects legacy route families', () => {
    const response = applyPortalRules(request('/dashboard/mobile-service?tab=area'), false, null);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/barber/dashboard/mobile-service?tab=area',
    );
  });

  it('sends protected portal visits to the matching login', () => {
    expect(applyPortalRules(request('/barber/dashboard'), false, null).headers.get('location')).toBe(
      'http://localhost:3000/barber/login?next=%2Fbarber%2Fdashboard',
    );
    expect(
      applyPortalRules(request('/client/appointments'), false, null).headers.get('location'),
    ).toBe('http://localhost:3000/client/login?next=%2Fclient%2Fappointments');
    expect(
      applyPortalRules(request('/client/design/look-id'), false, null).headers.get('location'),
    ).toBe('http://localhost:3000/client/login?next=%2Fclient%2Fdesign%2Flook-id');
  });

  it('redirects authenticated users away from the wrong portal', () => {
    expect(applyPortalRules(request('/barber/dashboard'), true, 'CLIENT').headers.get('location')).toBe(
      'http://localhost:3000/client',
    );
    expect(applyPortalRules(request('/client/barbers'), true, 'BARBER').headers.get('location')).toBe(
      'http://localhost:3000/barber/dashboard',
    );
  });

  it('requires an account for discovery and allows matching protected sessions', () => {
    expect(applyPortalRules(request('/client/barbers'), false, null).headers.get('location')).toBe(
      'http://localhost:3000/client/login?next=%2Fclient%2Fbarbers',
    );
    expect(
      applyPortalRules(request('/barber/dashboard/mobile-service'), true, 'BARBER').status,
    ).toBe(200);
    expect(applyPortalRules(request('/client/design/look-id'), true, 'CLIENT').status).toBe(200);
    expect(applyPortalRules(request('/client/barbers'), true, 'CLIENT').status).toBe(200);
  });

  it('allows users to open the other role auth flow to switch accounts', () => {
    expect(applyPortalRules(request('/barber/login'), true, 'CLIENT').status).toBe(200);
    expect(applyPortalRules(request('/client/register'), true, 'BARBER').status).toBe(200);
  });

  it('ignores a role claim when there is no active session', () => {
    expect(applyPortalRules(request('/barber/login'), false, null).status).toBe(200);
    expect(
      applyPortalRules(request('/barber/dashboard'), false, 'BARBER').headers.get('location'),
    ).toBe('http://localhost:3000/barber/login?next=%2Fbarber%2Fdashboard');
  });

  it('lets an authenticated session through when the role claim is unknown, rather than wrong', () => {
    // publicMetadata.userType only reaches the session token if the Clerk dashboard's "Customize
    // session token" claim is configured. A signed-in user must never be locked out of their own
    // portal just because that optional claim is missing or hasn't propagated yet.
    expect(applyPortalRules(request('/barber/dashboard'), true, null).status).toBe(200);
    expect(applyPortalRules(request('/client/barbers'), true, null).status).toBe(200);
  });
});
