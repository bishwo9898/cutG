export type UserType = 'CLIENT' | 'BARBER' | 'ADMIN';
export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type ServiceCategory = 'haircut' | 'beard' | 'shave' | 'color' | 'combo' | 'kids' | 'other';
export type SubscriptionTier = 'FREE' | 'BASIC' | 'PREMIUM';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  emailVerified: boolean;
  phone?: string | null;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data?: T[];
  items?: T[];
  appointments?: T[];
  barbers?: T[];
  services?: T[];
  reviews?: T[];
  payments?: T[];
  pagination?: Pagination;
};

export type PublicBarber = {
  id: string;
  businessName: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  city: string | null;
  state: string | null;
  averageRating: number;
  totalReviews: number;
  totalClients?: number;
  isVerified: boolean;
  subscriptionTier: SubscriptionTier;
  lowestServicePrice: number | null;
  serviceCategories: ServiceCategory[];
  nextAvailableSlot: string | null;
  stripeChargesEnabled?: boolean;
  onlinePaymentsAvailable?: boolean;
  distanceMiles?: number | null;
  mobileService?: PublicMobileService | null;
};

export type BarberProfile = PublicBarber & {
  address?: string | null;
  zipCode?: string | null;
  yearsOfExperience?: number | null;
  stripeOnboardingComplete?: boolean;
  stripePayoutsEnabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export type PublicMobileService = {
  isEnabled: true;
  serviceRadiusMiles: number;
  travelFeeStructure: FeeStructure;
  baseFee: number;
  perMileRate: number | null;
  notes: string | null;
};

export type FeeStructure = 'flat' | 'per_mile' | 'free';

export type MobileBarberConfig = {
  isEnabled: boolean;
  serviceRadiusMiles?: number;
  feeStructure?: FeeStructure;
  baseFeeCents?: number;
  perMileRateCents?: number;
  originLatitude?: number;
  originLongitude?: number;
  originAddress?: string | null;
  mobileServiceNotes?: string | null;
  suggestedFee: { flat: number; perMile: number; rationale: string };
};

export type ClientAddress = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
};

export type TravelEstimate = {
  isWithinRadius: true;
  distanceMiles: number;
  estimatedTravelMinutes: number;
  travelFeeCents: number;
  travelFee: number;
  breakdown: { serviceArea: string; feeStructure: FeeStructure; calculation: string };
};

export type BarberService = {
  id: string;
  barberId?: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  category: ServiceCategory;
  isActive: boolean;
};

export type AvailabilitySlot = {
  id: string;
  barberId: string;
  slotDate?: string;
  date?: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  status?: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
  isAvailable?: boolean;
  appointment?: AppointmentSummary | null;
  appointmentSummary?: {
    appointmentId: string;
    customerName: string;
    serviceName: string;
    status: string;
  };
  availableForMobile?: boolean;
};

export type AppointmentTimeline = {
  appointmentId: string;
  isMobileService: boolean;
  currentStatus: AppointmentStatus;
  departedAt: string | null;
  arrivedAt: string | null;
  timeline: Array<{
    status: AppointmentStatus;
    label: string;
    at: string | null;
    done: boolean;
    active: boolean;
  }>;
};

export type Review = {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  clientName?: string;
  createdAt: string;
};

export type AppointmentSummary = {
  id: string;
  barberId: string;
  clientId: string;
  serviceId: string;
  serviceName: string;
  barberName?: string;
  clientName?: string;
  clientPhone?: string | null;
  barberPhotoUrl?: string | null;
  scheduledDate: string;
  startTime: string;
  endTime?: string;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  price: number;
  durationMinutes: number;
  clientNotes?: string | null;
  barberNotes?: string | null;
  address?: string | null;
  hasReview?: boolean;
  isMobileService?: boolean;
  serviceAddress?: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
  } | null;
  distanceMiles?: number | null;
  estimatedTravelMinutes?: number | null;
  travelFeeCents?: number;
  travelFee?: number;
  pricing?: { serviceFee: number; travelFee: number; total: number };
  styleReference?: StyleReference | null;
};

export type StyleReference = {
  id: string;
  styleName: string | null;
  description: string | null;
  previewImageUrl: string | null;
  sourcePhotoUrl: string | null;
};

export type HairDesign = {
  id: string;
  styleName: string;
  styleCategory: 'haircut' | 'beard' | 'color' | 'combo';
  description: string | null;
  sourcePhotoUrl: string | null;
  generatedPreviewUrl: string | null;
  aiStatus: string;
  generationStatus: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | null;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  appointmentId: string | null;
  createdAt: string;
};

export type HairScanAngle = 'FRONT';

export type HairScan = {
  id: string;
  status: 'CAPTURING' | 'READY' | 'EXPIRED' | 'DELETED';
  analysisStatus: 'NOT_STARTED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  analysisError: string | null;
  selectedCaptureId: string | null;
  suggestions: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    reason: string;
  }>;
  captures: Array<{
    id: string;
    angle: HairScanAngle;
    uploadStatus: 'PENDING' | 'VERIFIED';
    width: number | null;
    height: number | null;
  }>;
  expiresAt: string;
};

export type HairStudioConfig = {
  enabled: boolean;
  provider: 'demo' | 'fal';
  consentVersion: string;
  requiredAngles: HairScanAngle[];
  maxCaptureBytes: number;
  retentionHours: number;
  dailyGenerationLimit: number;
  isMock: boolean;
};

export type BarberLocation =
  | { isTracking: false; reason: string; arrivedAt?: string | null }
  | {
      isTracking: true;
      appointmentId: string;
      barberName: string;
      lastPing: {
        latitude: number;
        longitude: number;
        headingDegrees: number | null;
        recordedAt: string;
        secondsAgo: number;
      };
      estimatedArrivalMinutes: number;
      distanceRemainingMiles: number;
    };

export type PaymentIntentResponse = {
  appointmentId: string;
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  breakdown?: {
    total: number;
    platformFee: number;
    barberEarns: number;
  };
};

export type PaymentStatusResponse = {
  appointmentId: string;
  paymentStatus: PaymentStatus;
  amount: number;
  stripePaymentIntentId?: string | null;
};

export type EarningsSummary = {
  totalEarnings: number;
  platformFees: number;
  pendingPayout: number;
  recentPayments?: AppointmentSummary[];
  payouts?: Array<{ id: string; amount: number; status: string; createdAt: string }>;
};

export type SubscriptionSummary = {
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  features?: string[];
};

export type StripeConnectStatus = {
  onboardingUrl?: string;
  accountId?: string | null;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
};

export const listFromResponse = <T>(response: Paginated<T> | T[]): T[] => {
  if (Array.isArray(response)) return response;
  return (
    response.data ??
    response.items ??
    response.appointments ??
    response.barbers ??
    response.services ??
    response.reviews ??
    response.payments ??
    []
  );
};
