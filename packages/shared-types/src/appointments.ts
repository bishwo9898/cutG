import type { AppointmentStatus, PaymentStatus } from './enums';
import type { LocationPingRequest } from './location';

export type AppointmentLocation = {
  kind: 'MOBILE' | 'SHOP';
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  isApproximateAddress: boolean;
};

export type AppointmentStyleReference = {
  id: string;
  styleName: string | null;
  description: string | null;
  previewImageUrl: string | null;
  sourcePhotoUrl: string | null;
};

export type BarberAppointmentDetail = {
  id: string;
  barberId: string;
  clientId: string;
  scheduledAt: string;
  scheduledDate: string;
  startTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'CASH' | 'CARD';
  service: { id: string; name: string };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  isMobileService: boolean;
  pricing: {
    serviceFee: number;
    travelFee: number;
    total: number;
    currency: 'USD';
  };
  location: AppointmentLocation | null;
  distanceMiles: number | null;
  estimatedTravelMinutes: number | null;
  clientNotes: string | null;
  barberNotes: string | null;
  styleNotes: string | null;
  styleReference: AppointmentStyleReference | null;
  journey: {
    departedAt: string | null;
    arrivedAt: string | null;
    isTracking: boolean;
    routeOrigin: { latitude: number; longitude: number } | null;
  };
};

export type StartJourneyRequest = LocationPingRequest;

export type StartJourneyResponse = {
  appointment: {
    id: string;
    status: 'ON_THE_WAY';
    departedAt: string;
  };
  tracking: {
    active: true;
    lastPingAt: string;
  };
};
