export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'BARBER' | 'CLIENT' | 'ADMIN';
  emailVerified: boolean;
  phone?: string | null;
};

export type BarberProfile = {
  id: string;
  userId: string;
  businessName: string;
  bio: string | null;
  yearsOfExperience: number | null;
  averageRating: number;
  totalReviews: number;
  totalClients: number;
  profilePhotoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionTier: 'FREE' | 'BASIC' | 'PREMIUM';
  isVerified: boolean;
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
  isVerified: boolean;
  subscriptionTier: 'FREE' | 'BASIC' | 'PREMIUM';
  lowestServicePrice: number | null;
  serviceCategories: string[];
  nextAvailableSlot: string | null;
  onlinePaymentsAvailable?: boolean;
  mobileService?: PublicMobileService | null;
};

export type PublicMobileService = {
  isEnabled: true;
  serviceRadiusMiles: number;
  travelFeeStructure: 'flat' | 'per_mile' | 'free';
  baseFee: number;
  perMileRate: number | null;
  notes: string | null;
};

export type PublicMobileConfig = {
  isEnabled: boolean;
  serviceRadiusMiles?: number;
  feeStructure?: 'flat' | 'per_mile' | 'free';
  baseFee?: number;
  perMileRate?: number | null;
  mobileServiceNotes?: string | null;
  originCity?: string | null;
  approximateOrigin?: { latitude: number; longitude: number };
};

export type BarberService = {
  id: string;
  barberId: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: 15 | 30 | 45 | 60 | 90 | 120;
  category: 'haircut' | 'beard' | 'shave' | 'color' | 'combo' | 'kids' | 'other';
  isActive: boolean;
};

export type PublicService = Pick<
  BarberService,
  'id' | 'name' | 'description' | 'price' | 'durationMinutes' | 'category'
>;

export type PublicSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  availableForMobile?: boolean;
};

export type ClientAddress = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
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
  breakdown?: {
    serviceArea: string;
    feeStructure: string;
    calculation: string;
  };
  source?: 'google' | 'mock';
};

export type AppointmentTimeline = {
  appointmentId: string;
  isMobileService: boolean;
  currentStatus: string;
  departedAt: string | null;
  arrivedAt: string | null;
  timeline: Array<{
    status: string;
    label: string;
    at: string | null;
    done: boolean;
    active: boolean;
  }>;
};

export type ScheduleEntry = {
  id?: string;
  dayOfWeek: number;
  dayName?: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: 15 | 30 | 45 | 60;
  isActive: boolean;
};

export type Appointment = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  paymentMethod: 'CASH' | 'CARD';
  priceQuoted: number;
  service: { id: string; name: string };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  clientNotes: string | null;
  barberNotes: string | null;
  isMobileService?: boolean;
  serviceAddress?: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number | null;
    longitude: number | null;
    formattedAddress?: string | null;
    source?: 'google' | 'coordinate_fallback' | null;
    isApproximateAddress?: boolean | null;
  } | null;
  distanceMiles?: number | null;
  estimatedTravelMinutes?: number | null;
  travelFee?: number;
  styleReference?: StyleReference | null;
};

export type ClientAppointment = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  paymentMethod: 'CASH' | 'CARD';
  priceQuoted: number;
  clientNotes: string | null;
  barberNotes: string | null;
  service: {
    id: string;
    name: string;
    price?: number;
    durationMinutes?: number;
    category?: string;
  };
  barber: {
    id: string;
    businessName: string;
    profilePhotoUrl: string | null;
    city: string | null;
    address?: string | null;
  };
  slot: PublicSlot | null;
  review: Review | null;
  isMobileService?: boolean;
  serviceAddress?: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
    formattedAddress?: string | null;
    source?: 'google' | 'coordinate_fallback' | null;
    isApproximateAddress?: boolean | null;
  } | null;
  distanceMiles?: number | null;
  estimatedTravelMinutes?: number | null;
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
  styleCategory: 'haircut' | 'beard' | 'color';
  description: string | null;
  sourcePhotoUrl: string | null;
  generatedPreviewUrl: string | null;
  aiStatus:
    'placeholder' | 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  generationStatus?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | null;
  progress?: number;
  provider?: string | null;
  model?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  appointmentId: string | null;
  createdAt: string;
};

export type HairScanAngle = 'FRONT' | 'LEFT' | 'RIGHT';

export type HairCaptureQuality = {
  brightness: number;
  sharpness: number;
  poseScore: number;
};

export type HairStyleSuggestion = {
  id: string;
  name: string;
  category: 'haircut' | 'beard' | 'color';
  description: string;
  reason: string;
};

export type HairScan = {
  id: string;
  status: 'CAPTURING' | 'READY' | 'EXPIRED' | 'DELETED';
  analysisStatus: 'NOT_STARTED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  analysisError: string | null;
  suggestions: HairStyleSuggestion[];
  captures: Array<{
    id: string;
    angle: HairScanAngle;
    uploadStatus: 'PENDING' | 'VERIFIED';
    width: number | null;
    height: number | null;
    quality: Partial<HairCaptureQuality>;
  }>;
  expiresAt: string;
  createdAt: string;
};

export type HairStudioConfig = {
  enabled: boolean;
  provider: 'demo' | 'gemini';
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

export type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  client?: {
    firstName: string;
    lastInitial: string;
  };
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
