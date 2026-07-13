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
  stripeChargesEnabled?: boolean;
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
};

export type BarberService = {
  id: string;
  barberId: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: 15 | 30 | 45 | 60 | 90 | 120;
  category: 'haircut' | 'beard' | 'shave' | 'combo' | 'kids' | 'other';
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
  } | null;
  distanceMiles?: number | null;
  estimatedTravelMinutes?: number | null;
  travelFee?: number;
};

export type ClientAppointment = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
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
  } | null;
  distanceMiles?: number | null;
  estimatedTravelMinutes?: number | null;
  travelFee?: number;
  pricing?: { serviceFee: number; travelFee: number; total: number };
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
