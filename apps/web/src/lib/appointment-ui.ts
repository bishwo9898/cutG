export type BookingStepState = 'upcoming' | 'current' | 'completed';
export type LocationFreshness = 'live' | 'delayed' | 'reconnecting';

export const bookingStepState = (index: number, currentIndex: number): BookingStepState =>
  index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';

export const appointmentStatusClass = (status: string): string => `status-${status.toLowerCase()}`;

export const locationFreshness = (secondsAgo: number): LocationFreshness =>
  secondsAgo < 30 ? 'live' : secondsAgo <= 60 ? 'delayed' : 'reconnecting';
