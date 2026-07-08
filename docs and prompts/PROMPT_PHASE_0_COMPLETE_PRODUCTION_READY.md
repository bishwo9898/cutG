# BARBER SAAS STARTUP - PHASE 0: PRODUCTION-GRADE FOUNDATION

## Complete Prompt for Claude Sonnet - Startup Ready

---

## EXECUTIVE SUMMARY (Read First)

You're building the **complete technical foundation** for a venture-backed SaaS startup. This is NOT a side project—it's the backbone that needs to:

- ✅ Scale to 10,000+ users without rewrite
- ✅ Be investor-presentable (clean, professional code)
- ✅ Attract senior engineers to your team
- ✅ Support complex future features (AI, payments, multi-tenant operations)
- ✅ Minimize technical debt from day 1

**This Phase 0 sets EVERYTHING.** If you get this right, Phase 1-10 are straightforward. If you cut corners, you'll be rewriting in 6 months.

---

## PROJECT CONTEXT

**Platform**: Barber Operations & Client Booking SaaS

- **Barbers** manage online presence, availability, earnings, client relationships
- **Clients** discover barbers, book appointments, pay online, leave reviews
- **Marketplace** aspect: Barbers compete on rating, price, availability
- **Payment processing**: Stripe integration (later phases)
- **Real-time requirements**: Live slot updates, instant notifications
- **AI-ready**: Future phases include recommendations, pricing optimization, demand forecasting

---

## YOUR OBJECTIVE

Create a **production-ready, scalable foundation** that includes:

1. **Complete monorepo** (pnpm workspaces) organized for independent scaling
2. **Enterprise PostgreSQL schema** with proper normalization, indexing, and constraints
3. **Type-safe infrastructure** (TypeScript + Zod) preventing runtime errors
4. **Reproducible local development** (Docker Compose with health checks)
5. **Database migrations** (Knex.js) that enable team collaboration
6. **Realistic seed data** for testing all user flows
7. **Professional configuration** (ESLint, Prettier, TypeScript strict mode)
8. **Comprehensive documentation** for onboarding new team members
9. **Zero compromise** on code quality—every file production-ready

---

## TECHNOLOGY STACK (LOCKED IN)

| Layer                 | Technology                      |
| --------------------- | ------------------------------- |
| **Runtime**           | Node.js 18+                     |
| **Backend Framework** | Express.js with TypeScript      |
| **Database**          | PostgreSQL 14+                  |
| **Package Manager**   | pnpm (workspaces)               |
| **Language**          | TypeScript (strict mode)        |
| **Migrations**        | Knex.js                         |
| **Validation**        | Zod (runtime schema validation) |
| **Type Generation**   | TypeScript types from Zod       |
| **Containerization**  | Docker + Docker Compose         |
| **Code Quality**      | ESLint + Prettier               |
| **API Format**        | REST (JSON responses)           |

---

## PROJECT FOLDER STRUCTURE (CREATE EXACTLY THIS)

```
barber-saas/
│
├── docker-compose.yml                  # Local dev environment
├── .env.example                        # Template (committed to git)
├── .env                                # Actual secrets (DO NOT COMMIT)
├── .gitignore                          # Git exclusions
├── pnpm-workspace.yaml                 # Monorepo config
├── package.json                        # Root workspace manifest
├── tsconfig.json                       # Shared TypeScript config
├── .prettierrc                         # Code formatting rules
├── .eslintrc.json                      # Linting config
├── README.md                           # Project overview
│
├── apps/
│   ├── api/                           # Express backend (THE CORE)
│   │   ├── src/
│   │   │   ├── index.ts               # Server entry point
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── constants.ts       # App constants
│   │   │   │   ├── database.ts        # PostgreSQL connection pool
│   │   │   │   └── env.ts             # Environment validation (Zod)
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── migrations/        # Knex migration files
│   │   │   │   │   └── 001_initial_schema.ts
│   │   │   │   └── seeds/
│   │   │   │       └── seed.ts        # Sample data
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── errorHandler.ts    # Global error handling
│   │   │   │   ├── cors.ts            # CORS configuration
│   │   │   │   └── logger.ts          # Request logging
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── health.ts          # GET /health endpoint
│   │   │   │   └── index.ts           # Route aggregation
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── logger.ts          # Logging utility
│   │   │       └── database.ts        # DB query helpers
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   ├── web/                           # Next.js (placeholder for Phase 4)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                        # React Native (placeholder for Phase 7)
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/                  # Shared TypeScript definitions
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── database.ts            # Zod schemas matching DB tables
│   │   │   ├── api.ts                 # API request/response types
│   │   │   └── enums.ts               # Shared enums (UserType, etc)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared-utils/                  # Shared utilities
│       ├── src/
│       │   ├── index.ts
│       │   └── validators.ts          # Common validators
│       ├── package.json
│       └── tsconfig.json
│
└── docs/
    ├── DATABASE.md                    # Complete schema documentation
    ├── API.md                         # API design patterns
    ├── SETUP.md                       # Developer setup guide
    ├── DEPLOYMENT.md                  # Deployment procedures
    └── ARCHITECTURE.md                # System architecture overview
```

---

## DATABASE SCHEMA (DETAILED SPECIFICATION)

### Why This Design?

This schema is optimized for:

- **Normalization** (no data duplication)
- **Concurrent writes** (barber schedules, client bookings)
- **Query performance** (strategic indexing)
- **Extensibility** (JSONB columns for future features)
- **Audit trails** (timestamps on every table)
- **Data integrity** (foreign keys, constraints)

### TABLE 1: `users` (Foundation for everyone)

```sql
CREATE TYPE user_type_enum AS ENUM ('BARBER', 'CLIENT', 'ADMIN');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,

  -- Profile
  phone VARCHAR(20) UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  -- Role & Status
  user_type user_type_enum NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMP,

  -- Metadata (JSONB for future extensibility)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP, -- Soft delete

  -- Constraints
  CONSTRAINT email_not_empty CHECK (email != ''),
  CONSTRAINT phone_or_email CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
```

### TABLE 2: `barber_profiles` (Extended profile for barbers)

```sql
CREATE TYPE subscription_tier_enum AS ENUM ('FREE', 'BASIC', 'PREMIUM');

CREATE TABLE barber_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Business Info
  business_name VARCHAR(255) NOT NULL,
  bio TEXT,
  years_of_experience INTEGER,

  -- Rating & Review System
  average_rating DECIMAL(3, 2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
  total_reviews INTEGER DEFAULT 0,
  total_clients INTEGER DEFAULT 0,

  -- Location (for geographic search)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),

  -- Media
  profile_photo_url VARCHAR(500),
  profile_photo_key VARCHAR(500), -- S3 key for deletion later

  -- Subscription & Payment
  subscription_tier subscription_tier_enum DEFAULT 'FREE',
  subscription_valid_until TIMESTAMP,
  stripe_account_id VARCHAR(255),

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT business_name_not_empty CHECK (business_name != '')
);

CREATE INDEX idx_barber_profiles_user_id ON barber_profiles(user_id);
CREATE INDEX idx_barber_profiles_average_rating ON barber_profiles(average_rating DESC);
CREATE INDEX idx_barber_profiles_subscription_tier ON barber_profiles(subscription_tier);
CREATE INDEX idx_barber_profiles_city ON barber_profiles(city);
CREATE INDEX idx_barber_profiles_is_verified ON barber_profiles(is_verified);
CREATE INDEX idx_barber_profiles_location ON barber_profiles USING GIST (
  ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL; -- PostGIS geospatial index
```

### TABLE 3: `services` (Haircut services offered by barbers)

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,

  -- Service Details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Pricing & Duration
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),

  -- Categorization
  category VARCHAR(50) NOT NULL, -- 'haircut', 'beard', 'shave', 'combo'

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata (for future AI categorization)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT name_not_empty CHECK (name != ''),
  CONSTRAINT price_positive CHECK (price > 0)
);

CREATE INDEX idx_services_barber_id ON services(barber_id);
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_barber_id_active ON services(barber_id, is_active);
```

### TABLE 4: `availability_slots` (Barber time availability)

```sql
CREATE TYPE slot_status_enum AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,

  -- Date & Time
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- Status
  status slot_status_enum DEFAULT 'AVAILABLE',

  -- Which appointment is using this (if booked)
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT start_before_end CHECK (start_time < end_time),
  CONSTRAINT valid_duration CHECK (duration_minutes > 0)
);

CREATE INDEX idx_availability_slots_barber_id ON availability_slots(barber_id);
CREATE INDEX idx_availability_slots_barber_date ON availability_slots(barber_id, slot_date);
CREATE INDEX idx_availability_slots_status ON availability_slots(status);
CREATE INDEX idx_availability_slots_slot_date ON availability_slots(slot_date);
CREATE INDEX idx_availability_slots_appointment_id ON availability_slots(appointment_id);
```

### TABLE 5: `appointments` (Client bookings)

```sql
CREATE TYPE appointment_status_enum AS ENUM (
  'PENDING',      -- Awaiting barber confirmation
  'CONFIRMED',    -- Barber accepted
  'IN_PROGRESS',  -- Barber started service
  'COMPLETED',    -- Service finished
  'CANCELLED',    -- Either party cancelled
  'NO_SHOW'       -- Client didn't show up
);

CREATE TYPE payment_status_enum AS ENUM (
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED'
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties Involved
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,

  -- Slot Reference
  availability_slot_id UUID REFERENCES availability_slots(id) ON DELETE SET NULL,

  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- Status
  status appointment_status_enum DEFAULT 'PENDING',
  payment_status payment_status_enum DEFAULT 'PENDING',

  -- Location
  location_address TEXT NOT NULL,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),

  -- Pricing
  price_quoted DECIMAL(10, 2) NOT NULL,
  price_paid DECIMAL(10, 2),

  -- Notes
  client_notes TEXT,
  barber_notes TEXT,
  cancellation_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,

  CONSTRAINT price_positive CHECK (price_quoted > 0),
  CONSTRAINT valid_duration CHECK (duration_minutes > 0)
);

CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at DESC);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_payment_status ON appointments(payment_status);
CREATE INDEX idx_appointments_client_scheduled ON appointments(client_id, scheduled_at DESC);
CREATE INDEX idx_appointments_barber_scheduled ON appointments(barber_id, scheduled_at DESC);
```

### TABLE 6: `payments` (Stripe payment records)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE RESTRICT,

  -- Amount & Currency
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0), -- Store as cents to avoid float issues
  currency VARCHAR(3) DEFAULT 'USD',

  -- Stripe IDs
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255) UNIQUE,

  -- Status
  status payment_status_enum DEFAULT 'PENDING',

  -- Refund Info
  refund_amount_cents INTEGER,
  refund_reason TEXT,
  refund_stripe_id VARCHAR(255),

  -- Error Tracking
  last_error_message TEXT,
  error_details JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refunded_at TIMESTAMP,

  CONSTRAINT refund_less_than_original CHECK (
    refund_amount_cents IS NULL OR refund_amount_cents <= amount_cents
  )
);

CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_barber_id ON payments(barber_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

### TABLE 7: `subscriptions` (Barber subscription management)

```sql
CREATE TYPE subscription_status_enum AS ENUM (
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL UNIQUE REFERENCES barber_profiles(id) ON DELETE CASCADE,

  -- Subscription Details
  tier subscription_tier_enum NOT NULL,
  status subscription_status_enum DEFAULT 'ACTIVE',

  -- Stripe Integration
  stripe_subscription_id VARCHAR(255) UNIQUE,

  -- Billing Cycle
  billing_cycle_start TIMESTAMP NOT NULL,
  billing_cycle_end TIMESTAMP NOT NULL,
  renewal_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,

  -- Features (extensible for future tiers)
  features JSONB NOT NULL DEFAULT '{
    "max_services": 5,
    "max_clients": 100,
    "advanced_analytics": false,
    "ai_recommendations": false
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,

  CONSTRAINT renewal_after_cycle_end CHECK (renewal_date > billing_cycle_end)
);

CREATE INDEX idx_subscriptions_barber_id ON subscriptions(barber_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_renewal_date ON subscriptions(renewal_date);
```

### TABLE 8: `reviews` (Client feedback)

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,

  -- Rating & Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,

  -- Verification
  is_verified_appointment BOOLEAN DEFAULT true,

  -- Engagement
  helpful_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_barber_id ON reviews(barber_id);
CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);
CREATE INDEX idx_reviews_client_id ON reviews(client_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_barber_created ON reviews(barber_id, created_at DESC);
```

### TABLE 9: `notifications` (System notification queue)

```sql
CREATE TYPE notification_type_enum AS ENUM (
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_CANCELLED',
  'REVIEW_REQUEST',
  'SUBSCRIPTION_RENEWAL',
  'SUBSCRIPTION_EXPIRING',
  'PROMOTION',
  'SYSTEM'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  type notification_type_enum NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Related Entity (JSONB for flexibility)
  related_data JSONB DEFAULT '{}'::jsonb,

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  -- Delivery Tracking
  sent_via_email BOOLEAN DEFAULT false,
  sent_via_sms BOOLEAN DEFAULT false,
  sent_via_push BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

---

## TypeScript Types & Schemas

All types come from **Zod schemas** (runtime validation + type inference):

```typescript
// packages/shared-types/src/database.ts

import { z } from 'zod';

// ==================== ENUMS ====================
export const UserTypeEnum = z.enum(['BARBER', 'CLIENT', 'ADMIN']);
export type UserType = z.infer<typeof UserTypeEnum>;

export const SubscriptionTierEnum = z.enum(['FREE', 'BASIC', 'PREMIUM']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierEnum>;

export const AppointmentStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusEnum>;

export const PaymentStatusEnum = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

// ==================== TABLES ====================

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  userType: UserTypeEnum,
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  emailVerifiedAt: z.date().optional(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const BarberProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  businessName: z.string(),
  bio: z.string().optional(),
  yearsOfExperience: z.number().int().optional(),
  averageRating: z.number().min(0).max(5).default(0),
  totalReviews: z.number().int().default(0),
  totalClients: z.number().int().default(0),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  profilePhotoUrl: z.string().url().optional(),
  profilePhotoKey: z.string().optional(),
  subscriptionTier: SubscriptionTierEnum.default('FREE'),
  subscriptionValidUntil: z.date().optional(),
  stripeAccountId: z.string().optional(),
  isVerified: z.boolean().default(false),
  verifiedAt: z.date().optional(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type BarberProfile = z.infer<typeof BarberProfileSchema>;

// ... (similar for other tables)

// ==================== API REQUEST/RESPONSE TYPES ====================

export const CreateAppointmentRequestSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  availabilitySlotId: z.string().uuid(),
  clientNotes: z.string().optional(),
});
export type CreateAppointmentRequest = z.infer<typeof CreateAppointmentRequestSchema>;

export const AppointmentResponseSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  scheduledAt: z.date(),
  status: AppointmentStatusEnum,
  paymentStatus: PaymentStatusEnum,
  priceQuoted: z.number(),
  createdAt: z.date(),
});
export type AppointmentResponse = z.infer<typeof AppointmentResponseSchema>;
```

---

## Configuration Files

### `.env.example` (Commit to git)

```env
# Node Environment
NODE_ENV=development
LOG_LEVEL=debug

# Server
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://barber_user:barber_password@localhost:5432/barber_saas
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# JWT (for Phase 1)
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRY=24h

# Stripe (for Phase 3)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# AWS S3 (for photo uploads in Phase 4)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=barber-saas-dev

# Email Service (for Phase 5)
SENDGRID_API_KEY=

# Frontend URLs
WEB_APP_URL=http://localhost:3000
MOBILE_APP_URL=barber-saas://

# Feature Flags
ENABLE_ANALYTICS=false
ENABLE_AI_FEATURES=false
```

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: barber_saas_postgres
    environment:
      POSTGRES_DB: barber_saas
      POSTGRES_USER: barber_user
      POSTGRES_PASSWORD: barber_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U barber_user -d barber_saas']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - barber-network

  redis:
    image: redis:7-alpine
    container_name: barber_saas_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - barber-network

volumes:
  postgres_data:
  redis_data:

networks:
  barber-network:
    driver: bridge
```

---

## Seed Data Requirements

Create realistic seed data that demonstrates all user flows:

### Sample Data Structure

```
3 Barber Profiles:
├── "Marcus's Barber Shop" (5★, 47 reviews, 120 clients)
│   ├── Services: Classic Cut ($15), Fade ($18), Beard Trim ($12), Full Service ($25)
│   ├── 20 availability slots across next 7 days
│   └── Subscription: PREMIUM
├── "Urban Cuts Barbershop" (4.8★, 32 reviews, 85 clients)
│   ├── Services: Haircut ($16), Line-up ($10), Shave ($20)
│   ├── 15 availability slots
│   └── Subscription: BASIC
└── "Classic Barber Studio" (4.5★, 18 reviews, 40 clients)
    ├── Services: Haircut ($12), Quick Trim ($8)
    ├── 10 availability slots
    └── Subscription: FREE

12 Client Users:
├── "John Client" - 3 completed appointments, 2 pending
├── "Sarah Johnson" - 5 completed appointments, 1 active
└── ... (10 more with varied booking patterns)

20 Appointments (mixed statuses):
├── 8 COMPLETED (with reviews)
├── 5 CONFIRMED (future dates)
├── 4 PENDING (awaiting barber confirmation)
├── 2 CANCELLED
└── 1 NO_SHOW

10 Payments:
├── 8 SUCCEEDED (matching completed appointments)
├── 2 PENDING (matching pending appointments)
```

**Requirements:**

- Use faker.js for realistic names, emails, addresses
- Spread appointments over past 30 days and next 14 days
- Dates should be realistic (no weekends if barbers don't work them)
- Reviews only exist for COMPLETED appointments
- Ratings distribution: 20% 5★, 40% 4★, 25% 3★, 15% 2-3★
- All foreign key relationships intact
- Barber locations in different US cities (for geo-search testing later)

---

## Deliverables Checklist

### ✅ Database Layer

- [ ] `apps/api/src/db/migrations/001_initial_schema.ts` - Knex migration with all 9 tables
- [ ] Database schema comment documentation explaining design decisions
- [ ] All enums, indexes, and constraints included
- [ ] Proper ON DELETE CASCADE/RESTRICT/SET NULL on foreign keys

### ✅ Seed Data

- [ ] `apps/api/src/db/seeds/seed.ts` - Realistic sample data
- [ ] Uses faker.js for name/email generation
- [ ] All relationships consistent
- [ ] Mix of appointment statuses for testing

### ✅ TypeScript Types

- [ ] `packages/shared-types/src/database.ts` - Zod schemas for all tables
- [ ] `packages/shared-types/src/enums.ts` - All enums exported
- [ ] `packages/shared-types/src/api.ts` - Request/response types
- [ ] All types exported from `packages/shared-types/src/index.ts`

### ✅ Configuration & Connection

- [ ] `apps/api/src/config/database.ts` - PostgreSQL connection pool
- [ ] `apps/api/src/config/env.ts` - Environment validation with Zod
- [ ] `apps/api/src/config/constants.ts` - App constants
- [ ] `.env.example` with all required variables
- [ ] Connection string works with docker-compose setup

### ✅ Base Express App

- [ ] `apps/api/src/index.ts` - Server entry point
- [ ] `apps/api/src/middleware/errorHandler.ts` - Global error handling
- [ ] `apps/api/src/middleware/cors.ts` - CORS configuration
- [ ] `apps/api/src/middleware/logger.ts` - Request logging
- [ ] `apps/api/src/routes/health.ts` - GET /health endpoint
- [ ] Graceful shutdown handling

### ✅ Utilities

- [ ] `apps/api/src/utils/logger.ts` - Structured logging
- [ ] `apps/api/src/utils/database.ts` - Database helper functions
- [ ] Error types and handling patterns

### ✅ Configuration Files

- [ ] Root `package.json` with pnpm workspaces
- [ ] Root `tsconfig.json` with strict mode
- [ ] `.eslintrc.json` with professional rules
- [ ] `.prettierrc` with consistent formatting
- [ ] `pnpm-workspace.yaml` defining workspaces

### ✅ Docker

- [ ] `docker-compose.yml` with PostgreSQL + Redis
- [ ] `apps/api/Dockerfile` for API container
- [ ] Health checks on all services
- [ ] Named volumes for data persistence

### ✅ Scripts & Package Management

- [ ] Root: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm db:migrate`, `pnpm db:seed`
- [ ] `apps/api`: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm db:migrate`, `pnpm db:seed`
- [ ] All scripts properly use workspaces

### ✅ Documentation

- [ ] `docs/DATABASE.md` - Full schema documentation with ER diagram
- [ ] `docs/SETUP.md` - Step-by-step developer setup guide
- [ ] `docs/ARCHITECTURE.md` - System design and decisions
- [ ] `README.md` - Project overview and quick start
- [ ] Inline code comments explaining non-obvious logic

### ✅ Git & IDE

- [ ] `.gitignore` - Excludes node_modules, .env, dist, etc
- [ ] VSCode settings (optional but helpful) - TypeScript strict mode
- [ ] EditorConfig for consistent formatting

---

## Success Criteria (You'll Know It's Done When...)

```bash
# 1. Clone repo, install dependencies
cd barber-saas
pnpm install
✅ All dependencies installed, no warnings

# 2. Start Docker
docker-compose up -d
✅ PostgreSQL and Redis containers running

# 3. Run migrations
pnpm db:migrate
✅ All 9 tables created in PostgreSQL

# 4. Seed data
pnpm db:seed
✅ 3 barbers, 12 clients, 20 appointments loaded

# 5. Start API server
cd apps/api && pnpm dev
✅ Server starts on port 3000

# 6. Health check
curl http://localhost:3000/health
✅ Returns: { "status": "ok", "timestamp": "2024-..." }

# 7. Database query
psql postgresql://barber_user:barber_password@localhost:5432/barber_saas -c "SELECT COUNT(*) FROM users;"
✅ Returns: 15 (3 barbers + 12 clients)

# 8. Code quality
pnpm lint
✅ Zero ESLint errors

# 9. Type checking
pnpm tsc --noEmit
✅ Zero TypeScript errors

# 10. Database connects
pnpm db:connect
✅ psql opens connected to barber_saas database

# 11. Examine types
cat packages/shared-types/src/index.ts
✅ All types exported and usable

# 12. Examine schema
psql postgresql://barber_user:barber_password@localhost:5432/barber_saas -c "\d"
✅ Shows all 9 tables
```

---

## Code Quality Standards

### TypeScript

- **Strict Mode**: `"strict": true` in tsconfig.json
- **No `any`**: Use proper types; no escaping with `any`
- **Return Types**: Always annotate function return types
- **Type Exports**: Export types from index.ts for easy importing

### Naming

- **Variables**: camelCase (`firstName`, `isActive`, `createdAt`)
- **Types**: PascalCase (`User`, `BarberProfile`, `CreateUserRequest`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_PORT`)
- **Database**: snake_case (`user_id`, `created_at`, `is_active`)

### Code Organization

- **One responsibility per file**
- **Logical folder grouping** (config, routes, middleware, utils)
- **Index files** for clean imports (`import { User } from '@shared/types'`)
- **Comments explain WHY**, not WHAT (code should be self-explanatory)

### Error Handling

- **Never silently fail** - throw or log all errors
- **Type-safe errors** - create custom error classes
- **Meaningful messages** - errors should be debuggable
- **Stack traces** - log full context for debugging

---

## Database Design Decisions Explained

### Why These Indexes?

- **Composite indexes** on commonly filtered columns together
- **Sorted indexes** (DESC) on created_at for recent-first queries
- **Partial indexes** (WHERE clause) to reduce size and improve performance
- **PostGIS index** on location for geographic search (Phase 2)

### Why JSONB Columns?

- **metadata** on users/barbers: For future extensibility without schema changes
- **related_data** on notifications: Flexible event data
- **features** on subscriptions: Tier feature sets can evolve

### Why These Constraints?

- **CHECK constraints**: Data integrity at database level
- **UNIQUE constraints**: Prevent duplicates where needed
- **FOREIGN KEY**: Referential integrity; prevent orphaned records
- **NOT NULL**: Required fields enforce data completeness

### Why Soft Deletes?

- **deleted_at**: Keep historical data for audits/analytics
- **Partial index**: `WHERE deleted_at IS NULL` for faster active-record queries
- **Alternative**: Can add is_archived BOOLEAN if soft delete not needed

---

## What's NOT Included (Intentionally)

❌ Authentication routes (Phase 1)  
❌ Appointment booking logic (Phase 1)  
❌ Payment processing (Phase 3)  
❌ Real-time features (Phase 5)  
❌ Admin endpoints (Phase 6)  
❌ React/Vue/Next.js components  
❌ Mobile app setup  
❌ Tests/test fixtures  
❌ Stripe webhooks  
❌ Email sending

**This is FOUNDATION ONLY.** Each can be built independently once this is solid.

---

## Additional Notes for Production Readiness

### Connection Pooling

- Uses connection pool (min 2, max 10 connections)
- Prevents "too many connections" errors under load
- Automatically recycles stale connections

### Logging

- All database operations logged (with sanitized queries)
- Startup logs include schema version
- Errors logged with full context

### Error Recovery

- Migration rollback capability
- Seed script idempotent (can run multiple times safely)
- Database health checks before server starts

### Scalability Considerations

- Schema designed for read replicas (foreign keys, indexes)
- Partitioning strategy documented for future (appointments table could partition by date)
- No stored procedures (keep logic in application layer)
- Normalized schema avoids data duplication at scale

---

## IMPORTANT: Before Running Migrations

1. **Back up any existing data** (there shouldn't be any for fresh start)
2. **Verify DATABASE_URL** in .env points to intended database
3. **Ensure PostgreSQL is running** (docker-compose up)
4. **Run migrations in correct order** (Knex handles this)
5. **Never modify migration files** after they've run (create new migrations instead)

---

## Getting Started

### Prerequisites Check

- [ ] Node.js 18+ installed (`node -v`)
- [ ] pnpm 8+ installed (`pnpm -v`)
- [ ] Docker installed (`docker --version`)
- [ ] PostgreSQL knowledge (basic)

### Step 1: Initialize Project

```bash
mkdir barber-saas
cd barber-saas
git init
# You'll receive all files in response
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Start Database

```bash
docker-compose up -d
```

### Step 4: Run Schema & Seeds

```bash
pnpm db:migrate
pnpm db:seed
```

### Step 5: Start Development

```bash
cd apps/api
pnpm dev
```

### Step 6: Test

```bash
curl http://localhost:3000/health
```

---

## What Comes After Phase 0

Once this foundation is complete and verified:

**Phase 1** (Prompt Set 2): Authentication System

- User registration & login
- JWT token management
- Email verification
- Role-based middleware

**Phase 2** (Prompt Set 3): Barber & Service APIs

- Barber profile management
- Service CRUD
- Availability scheduling
- Photo uploads to S3

**Phase 3** (Prompt Set 4): Client Features

- Barber search & discovery
- Location-based filtering
- Appointment booking flow
- Review system

...and so on.

---

## Questions to Ask Yourself Before Starting

- ✅ Have you reviewed the schema and understand each table?
- ✅ Do you understand why each index exists?
- ✅ Can you explain the JSONB usage?
- ✅ Do you understand soft deletes and when to use them?
- ✅ Have you noted the constraints and why they matter?

If you answered yes to all, you're ready. If no, re-read those sections.

---

## Final Checklist Before Submitting to Claude

- [ ] Read entire prompt
- [ ] Understand all 9 tables
- [ ] Know what deliverables are expected
- [ ] Reviewed success criteria
- [ ] Ready to provide file-by-file output
- [ ] Understand this is production-grade startup code

---

**This is your foundation. Build it right. Everything else depends on it.**

**You've got this. 🚀**
