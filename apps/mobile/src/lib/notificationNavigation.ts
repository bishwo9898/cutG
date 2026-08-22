import type { AuthUser } from './types';

export const notificationDestination = (
  data: Record<string, unknown>,
  user: AuthUser | null,
): string => {
  const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : null;
  if (appointmentId === null || user === null) return '/notifications';
  return user.userType === 'BARBER'
    ? `/(barber)/appointments/${appointmentId}`
    : `/(client)/appointments/${appointmentId}`;
};
