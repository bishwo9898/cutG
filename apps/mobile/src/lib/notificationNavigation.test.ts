import { describe, expect, it } from 'vitest';

import { notificationDestination } from './notificationNavigation';
import type { AuthUser } from './types';

const user = (userType: 'CLIENT' | 'BARBER'): AuthUser => ({
  id: 'user-id',
  email: 'person@example.com',
  firstName: 'Test',
  lastName: 'Person',
  userType,
  emailVerified: true,
});

describe('notificationDestination', () => {
  it('opens only role-owned appointment routes', () => {
    expect(notificationDestination({ appointmentId: 'appointment-id' }, user('CLIENT'))).toBe(
      '/(client)/appointments/appointment-id',
    );
    expect(notificationDestination({ appointmentId: 'appointment-id' }, user('BARBER'))).toBe(
      '/(barber)/appointments/appointment-id',
    );
  });

  it('falls back to the inbox for unauthenticated or unrelated notifications', () => {
    expect(notificationDestination({}, user('CLIENT'))).toBe('/notifications');
    expect(notificationDestination({ appointmentId: 'appointment-id' }, null)).toBe(
      '/notifications',
    );
  });
});
