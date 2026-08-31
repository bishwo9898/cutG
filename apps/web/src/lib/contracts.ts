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
  headline: string | null;
  businessType: 'INDEPENDENT' | 'SHOP';
  bio: string | null;
  yearsOfExperience: number | null;
  languages: string[];
  specialties: string[];
  averageRating: number;
  totalReviews: number;
  totalClients: number;
  profilePhotoUrl: string | null;
  bannerUrl: string | null;
  bannerAssetType: 'image' | 'video' | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionTier: 'FREE' | 'BASIC' | 'PREMIUM';
  isVerified: boolean;
  portfolioCompletedAt: string | null;
};

export type PortfolioCategory =
  | 'BURST_FADE'
  | 'MID_FADE'
  | 'LOW_FADE'
  | 'HIGH_FADE'
  | 'TAPER'
  | 'CURLY'
  | 'AFRO'
  | 'BEARD'
  | 'SCISSOR_CUTS'
  | 'KIDS'
  | 'LONG_HAIR'
  | 'DESIGNS';

export type PortfolioItem = {
  id: string;
  barberId: string;
  title: string;
  description: string | null;
  category: PortfolioCategory;
  hairType: 'STRAIGHT' | 'WAVY' | 'CURLY' | 'COILY';
  hairDensity: 'THIN' | 'MEDIUM' | 'THICK';
  hairLengthBefore: string;
  hairLengthAfter: string;
  faceShape: 'OVAL' | 'ROUND' | 'SQUARE';
  cutStyle: string;
  timeTakenMinutes: number;
  productsUsed: string[];
  difficulty: 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED';
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkExperience = {
  id: string;
  shopName: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
};

export type BarberCertification = {
  id: string;
  name: string;
  issuer: string;
  issueDate: string | null;
  expirationDate: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
};

export type PortfolioTrust = {
  totalClients: number;
  repeatClients: number;
  repeatClientPercentage: number | null;
  windowDays: number;
  monthlyRepeatClients: Array<{ month: string; repeatClients: number }>;
};

export type BarberPortfolio = {
  items: PortfolioItem[];
  experiences: WorkExperience[];
  certifications: BarberCertification[];
  trust: PortfolioTrust;
  nextAvailableAppointment?: { date: string; startTime: string } | null;
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
  distanceMiles?: number | null;
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
  imageUrl: string | null;
  price: number;
  durationMinutes: 15 | 30 | 45 | 60 | 90 | 120;
  category: 'haircut' | 'beard' | 'shave' | 'color' | 'combo' | 'kids' | 'other';
  isActive: boolean;
};

export type PublicService = Pick<
  BarberService,
  'id' | 'name' | 'description' | 'imageUrl' | 'price' | 'durationMinutes' | 'category'
>;

export type PublicSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Bookable right now: free, and not already in the past. */
  isAvailable: boolean;
  isPast?: boolean;
  status?: 'AVAILABLE' | 'BOOKED' | 'PAST';
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
  styleNotes?: string | null;
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
  styleNotes?: string | null;
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
  styleCategory: 'haircut' | 'beard' | 'color' | 'combo';
  description: string | null;
  sourcePhotoUrl: string | null;
  generatedPreviewUrl: string | null;
  imageStorage?: 'cloudinary' | 'private-object-storage';
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
  category: 'haircut' | 'beard' | 'color' | 'combo';
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
  selectedCaptureId?: string | null;
};

export type HairStudioConfig = {
  enabled: boolean;
  provider: 'demo' | 'fal';
  consentVersion: string;
  requiredAngles: HairScanAngle[];
  webRequiredAngles?: HairScanAngle[];
  maxCaptureBytes: number;
  retentionHours: number;
  dailyGenerationLimit: number;
  isMock: boolean;
  imageStorage?: 'cloudinary' | 'private-object-storage';
};

export type HairStudioConsent = {
  accepted: boolean;
  ageConfirmed: boolean;
  faceProcessingConsented: boolean;
  consentVersion: string;
  acceptedAt: string | null;
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
