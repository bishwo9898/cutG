import {
  ApiClient,
  ApiError,
  barberBillingApi,
  barberDiscoveryApi,
  clientApi,
  mobileBarberApi,
  paymentApi,
} from '@barber-saas/api-client';
import type {
  BookAppointmentRequest,
  BarberAppointmentDetail,
  CreateBarberProfileRequest,
  CreateReviewRequest,
  CreateServiceRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateBarberProfileRequest,
  UpdateProfileRequest,
  UpdateServiceRequest,
  SaveAddressRequest,
  SetMobileConfigRequest,
  StartJourneyRequest,
  StartJourneyResponse,
  TravelEstimateRequest,
  UpdateAddressRequest,
} from '@barber-saas/shared-types';
import ExpoConstants from 'expo-constants';
import { Platform } from 'react-native';

import { useAuthStore } from '@/store/authStore';

import type {
  AppointmentSummary,
  AppointmentTimeline,
  BarberLocation,
  AuthUser,
  AvailabilitySlot,
  BarberProfile,
  BarberService,
  ClientAddress,
  EarningsSummary,
  LoginResponse,
  Paginated,
  PaymentIntentResponse,
  PaymentStatusResponse,
  PublicBarber,
  Review,
  StripeConnectStatus,
  SubscriptionSummary,
  MobileBarberConfig,
  TravelEstimate,
  HairDesign,
  HairScan,
  HairStudioConfig,
} from './types';

const expoDevelopmentHost = ExpoConstants.expoConfig?.hostUri?.split(':')[0];
const defaultDevelopmentApiUrl =
  expoDevelopmentHost !== undefined && expoDevelopmentHost.length > 0
    ? `http://${expoDevelopmentHost}:4000`
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:4000'
      : 'http://localhost:4000';

export const MOBILE_API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultDevelopmentApiUrl;

const publicClient = new ApiClient({ baseUrl: MOBILE_API_URL });

const createAuthedClient = (): ApiClient =>
  new ApiClient({
    baseUrl: MOBILE_API_URL,
    headers: (): Record<string, string> => {
      const token = useAuthStore.getState().accessToken;
      return token === null ? {} : { Authorization: 'Bearer ' + token };
    },
  });

const refreshAccessToken = async (): Promise<boolean> => {
  const { refreshToken, setAccessToken, clearAuth } = useAuthStore.getState();
  if (refreshToken === null) {
    await clearAuth();
    return false;
  }

  try {
    const response = await publicClient.post<{ accessToken: string }>('/auth/refresh', {
      refreshToken,
    });
    await setAccessToken(response.accessToken);
    return true;
  } catch {
    await clearAuth();
    return false;
  }
};

const withAuth = async <T>(operation: (client: ApiClient) => Promise<T>): Promise<T> => {
  try {
    return await operation(createAuthedClient());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && (await refreshAccessToken())) {
      return operation(createAuthedClient());
    }
    throw error;
  }
};

const paramsToQuery = (params?: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query.length > 0 ? '?' + query : '';
};

export const mobileApi = {
  auth: {
    register: (body: RegisterRequest): Promise<{ user: AuthUser; message?: string }> =>
      publicClient.post('/auth/register', body),
    verifyEmail: (email: string, verificationCode: string): Promise<{ message: string }> =>
      publicClient.post('/auth/verify-email', { email, verificationCode }),
    login: (body: LoginRequest): Promise<LoginResponse> => publicClient.post('/auth/login', body),
    logout: (): Promise<{ message: string }> => withAuth((client) => client.post('/auth/logout')),
    me: (): Promise<AuthUser> => withAuth((client) => client.get('/auth/me')),
    updateMe: (body: UpdateProfileRequest): Promise<AuthUser> =>
      withAuth((client) => client.patch('/auth/me', body)),
    forgotPassword: (email: string): Promise<{ message: string }> =>
      publicClient.post('/auth/forgot-password', { email }),
    resetPassword: (body: ResetPasswordRequest): Promise<{ message: string }> =>
      publicClient.post('/auth/reset-password', body),
  },
  discovery: {
    search: (
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<PublicBarber>> => barberDiscoveryApi.search(publicClient, params),
    profile: (barberId: string): Promise<BarberProfile> =>
      barberDiscoveryApi.getProfile(publicClient, barberId),
    services: (barberId: string): Promise<Paginated<BarberService>> =>
      barberDiscoveryApi.getServices(publicClient, barberId),
    slots: (
      barberId: string,
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<AvailabilitySlot>> =>
      barberDiscoveryApi.getSlots(publicClient, barberId, params),
    reviews: (
      barberId: string,
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<Review>> => barberDiscoveryApi.getReviews(publicClient, barberId, params),
  },
  client: {
    me: (): Promise<AuthUser> => withAuth((client) => clientApi.me(client)),
    savedBarbers: (): Promise<Paginated<PublicBarber>> =>
      withAuth((client) => clientApi.savedBarbers(client)),
    saveBarber: (barberId: string): Promise<{ saved: boolean }> =>
      withAuth((client) => clientApi.saveBarber(client, barberId)),
    removeSavedBarber: (barberId: string): Promise<{ removed: boolean }> =>
      withAuth((client) => clientApi.removeSavedBarber(client, barberId)),
    bookAppointment: (body: BookAppointmentRequest): Promise<AppointmentSummary> =>
      withAuth((client) => clientApi.bookAppointment(client, body)),
    appointments: (
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<AppointmentSummary>> =>
      withAuth((client) => clientApi.appointments(client, params)),
    appointment: (appointmentId: string): Promise<AppointmentSummary> =>
      withAuth((client) => clientApi.appointment(client, appointmentId)),
    appointmentStatusUpdates: (appointmentId: string): Promise<AppointmentTimeline> =>
      withAuth((client) => clientApi.appointmentStatusUpdates(client, appointmentId)),
    barberLocation: (appointmentId: string): Promise<BarberLocation> =>
      withAuth((client) => clientApi.barberLocation(client, appointmentId)),
    cancelAppointment: (appointmentId: string): Promise<AppointmentSummary> =>
      withAuth((client) => clientApi.cancelAppointment(client, appointmentId)),
    createReview: (body: CreateReviewRequest): Promise<Review> =>
      withAuth((client) => clientApi.createReview(client, body)),
    paymentHistory: (): Promise<Paginated<PaymentStatusResponse>> =>
      withAuth((client) => clientApi.paymentHistory(client)),
    addresses: (): Promise<{ addresses: ClientAddress[] }> =>
      withAuth((client) => clientApi.addresses(client)),
    createAddress: (body: SaveAddressRequest): Promise<ClientAddress> =>
      withAuth((client) => clientApi.createAddress(client, body)),
    updateAddress: (addressId: string, body: UpdateAddressRequest): Promise<ClientAddress> =>
      withAuth((client) => clientApi.updateAddress(client, addressId, body)),
    deleteAddress: (addressId: string): Promise<{ message: string }> =>
      withAuth((client) => clientApi.deleteAddress(client, addressId)),
    setDefaultAddress: (addressId: string): Promise<ClientAddress> =>
      withAuth((client) => clientApi.setDefaultAddress(client, addressId)),
    designs: (): Promise<{ designs: HairDesign[] }> =>
      withAuth((client) => clientApi.designs(client)),
    hairStudioConfig: (): Promise<HairStudioConfig> =>
      withAuth((client) => clientApi.hairStudioConfig(client)),
    createHairScan: (body: unknown): Promise<HairScan> =>
      withAuth((client) => clientApi.createHairScan(client, body)),
    hairScan: (scanId: string): Promise<HairScan> =>
      withAuth((client) => clientApi.hairScan(client, scanId)),
    presignHairCapture: (
      scanId: string,
      body: unknown,
    ): Promise<{ captureId: string; uploadUrl: string; headers: Record<string, string> }> =>
      withAuth((client) => clientApi.presignHairCapture(client, scanId, body)),
    completeHairCapture: (scanId: string, captureId: string, body: unknown): Promise<unknown> =>
      withAuth((client) => clientApi.completeHairCapture(client, scanId, captureId, body)),
    validateHairScan: (scanId: string, body: unknown): Promise<HairScan> =>
      withAuth((client) => clientApi.validateHairScan(client, scanId, body)),
    generateDesign: (body: unknown): Promise<HairDesign> =>
      withAuth((client) => clientApi.generateDesign(client, body)),
    design: (designId: string): Promise<HairDesign> =>
      withAuth((client) => clientApi.design(client, designId)),
    retryDesign: (designId: string, body: unknown): Promise<HairDesign> =>
      withAuth((client) => clientApi.retryDesign(client, designId, body)),
    deleteDesign: (designId: string): Promise<{ message: string }> =>
      withAuth((client) => clientApi.deleteDesign(client, designId)),
    createDesign: (body: {
      styleName: string;
      styleCategory: 'haircut' | 'beard' | 'color' | 'combo';
      description?: string;
    }): Promise<HairDesign> => withAuth((client) => clientApi.createDesign(client, body)),
    attachDesign: (designId: string, appointmentId: string): Promise<{ message: string }> =>
      withAuth((client) => clientApi.attachDesign(client, designId, appointmentId)),
  },
  payments: {
    createIntent: (appointmentId: string): Promise<PaymentIntentResponse> =>
      withAuth((client) => paymentApi.createIntent(client, appointmentId)),
    appointmentStatus: (appointmentId: string): Promise<PaymentStatusResponse> =>
      withAuth((client) => paymentApi.appointmentStatus(client, appointmentId)),
    refund: (appointmentId: string, reason?: string): Promise<PaymentStatusResponse> =>
      withAuth((client) => paymentApi.refund(client, appointmentId, reason)),
  },
  barber: {
    profile: (): Promise<BarberProfile> => withAuth((client) => client.get('/barbers/me')),
    createProfile: (body: CreateBarberProfileRequest): Promise<BarberProfile> =>
      withAuth((client) => client.post('/barbers/me/profile', body)),
    updateProfile: (body: UpdateBarberProfileRequest): Promise<BarberProfile> =>
      withAuth((client) => client.patch('/barbers/me/profile', body)),
    updatePhoto: (photoUrl: string): Promise<BarberProfile> =>
      withAuth((client) => client.post('/barbers/me/photo', { photoUrl })),
    services: (
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<BarberService>> =>
      withAuth((client) => client.get('/barbers/me/services' + paramsToQuery(params))),
    createService: (body: CreateServiceRequest): Promise<BarberService> =>
      withAuth((client) => client.post('/barbers/me/services', body)),
    updateService: (serviceId: string, body: UpdateServiceRequest): Promise<BarberService> =>
      withAuth((client) => client.patch('/barbers/me/services/' + serviceId, body)),
    deleteService: (serviceId: string): Promise<{ deleted: boolean }> =>
      withAuth((client) => client.delete('/barbers/me/services/' + serviceId)),
    schedule: (): Promise<{ schedule: unknown[] }> =>
      withAuth((client) => client.get('/barbers/me/schedule')),
    updateSchedule: (schedule: unknown[]): Promise<{ schedule: unknown[] }> =>
      withAuth((client) => client.put('/barbers/me/schedule', { schedule })),
    slots: (
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<AvailabilitySlot>> =>
      withAuth((client) => client.get('/barbers/me/slots' + paramsToQuery(params))),
    appointments: (
      params?: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<AppointmentSummary>> =>
      withAuth((client) => client.get('/barbers/me/appointments' + paramsToQuery(params))),
    appointment: (appointmentId: string): Promise<BarberAppointmentDetail> =>
      withAuth((client) => mobileBarberApi.appointment(client, appointmentId)),
    updateAppointmentStatus: (
      appointmentId: string,
      body: { status: string; notes?: string },
    ): Promise<AppointmentSummary> =>
      withAuth((client) =>
        client.patch('/barbers/me/appointments/' + appointmentId + '/status', body),
      ),
    stripeStatus: (): Promise<StripeConnectStatus> =>
      withAuth((client) => barberBillingApi.stripeStatus(client)),
    connectStripe: (): Promise<StripeConnectStatus> =>
      withAuth((client) => barberBillingApi.connectStripe(client)),
    earnings: (period?: string): Promise<EarningsSummary> =>
      withAuth((client) => barberBillingApi.earnings(client, { period })),
    subscription: (): Promise<SubscriptionSummary> =>
      withAuth((client) => barberBillingApi.subscription(client)),
    checkout: (tier: 'BASIC' | 'PREMIUM', interval: 'month' | 'year'): Promise<{ url: string }> =>
      withAuth((client) => barberBillingApi.checkout(client, { tier, interval })),
    cancelSubscription: (): Promise<SubscriptionSummary> =>
      withAuth((client) => barberBillingApi.cancelSubscription(client)),
    resumeSubscription: (): Promise<SubscriptionSummary> =>
      withAuth((client) => barberBillingApi.resumeSubscription(client)),
    mobileConfig: (): Promise<MobileBarberConfig> =>
      withAuth((client) => mobileBarberApi.config(client)),
    updateMobileConfig: (body: SetMobileConfigRequest): Promise<MobileBarberConfig> =>
      withAuth((client) => mobileBarberApi.updateConfig(client, body)),
    disableMobile: (): Promise<{ isEnabled: false; message: string }> =>
      withAuth((client) => mobileBarberApi.disable(client)),
    travelEstimate: (body: TravelEstimateRequest): Promise<TravelEstimate> =>
      withAuth((client) => mobileBarberApi.estimate(client, body)),
    sendLocationPing: (
      appointmentId: string,
      body: {
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
        headingDegrees?: number;
        speedMs?: number;
      },
    ): Promise<{ recorded: boolean }> =>
      withAuth((client) => mobileBarberApi.sendLocationPing(client, appointmentId, body)),
    startJourney: (
      appointmentId: string,
      body: StartJourneyRequest,
    ): Promise<StartJourneyResponse> =>
      withAuth((client) => mobileBarberApi.startJourney(client, appointmentId, body)),
  },
};

export { ApiError } from '@barber-saas/api-client';
