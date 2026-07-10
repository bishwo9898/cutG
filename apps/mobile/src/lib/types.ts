export type UserType = 'CLIENT' | 'BARBER' | 'ADMIN';
export type AppointmentStatus =
  'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type ServiceCategory = 'haircut' | 'beard' | 'shave' | 'combo' | 'kids' | 'other';
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
};

export type BarberProfile = PublicBarber & {
  address?: string | null;
  zipCode?: string | null;
  yearsOfExperience?: number | null;
  stripeOnboardingComplete?: boolean;
  stripePayoutsEnabled?: boolean;
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
  slotDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
  appointment?: AppointmentSummary | null;
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
