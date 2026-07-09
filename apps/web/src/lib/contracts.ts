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
};
