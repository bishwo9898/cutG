# BARBER SAAS — PHASE 2: BARBER PROFILE & SERVICE MANAGEMENT

## Agent Implementation Prompt for Codex (please take your time and use your best judgement. Rather take longer for fuguring out things than creating errors and problems. Thank you so much!)

---

## CONTEXT: WHERE WE ARE

This is a pnpm monorepo for a barber operations and client booking SaaS platform.

**What already exists and works:**

- Phase 0 ✅ — Foundation: PostgreSQL schema (9 tables), Express server, Docker, shared types, seed data
- Phase 1 ✅ — Authentication: Register, login, logout, JWT tokens, refresh, role middleware, profile update, password reset

**Current working endpoints:**

```
GET  /           → API root
GET  /health     → Database-aware health check
POST /auth/register
POST /auth/verify-email
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
PATCH /auth/me
POST /auth/forgot-password
POST /auth/reset-password
```

**Tech stack already in place:**

- Node.js 18+ with Express + TypeScript (strict mode)
- PostgreSQL 14+ via Knex.js
- Zod for runtime validation
- JWT for authentication
- bcrypt for password hashing
- pnpm workspaces monorepo
- Docker Compose (PostgreSQL + Redis)
- Shared packages: `@barber-saas/shared-types`, `@barber-saas/shared-utils`

**Existing file structure:**

```
apps/api/src/
├── index.ts
├── config/
│   ├── database.ts
│   ├── env.ts
│   └── constants.ts
├── middleware/
│   ├── auth.ts          ← JWT validation + requireRole() already built
│   ├── cors.ts
│   └── errorHandler.ts
├── routes/
│   ├── index.ts
│   ├── health.ts
│   └── auth.ts
├── services/auth/
│   ├── authService.ts
│   ├── tokenService.ts
│   ├── passwordService.ts
│   ├── userService.ts
│   └── emailService.ts
└── db/
    ├── migrations/
    │   ├── 001_initial_schema.ts
    │   └── 002_auth_tables.ts
    └── seeds/seed.ts

packages/shared-types/src/
├── enums.ts
├── database.ts
├── api.ts
├── auth.ts
└── index.ts
```

---

## PHASE 2 OBJECTIVE

Build the **complete barber-side business management APIs**. After this phase, a barber can:

1. Complete and manage their business profile
2. Create, update, and delete services they offer
3. Set and manage their weekly availability schedule
4. Generate time slots from their schedule
5. View their own upcoming appointments (read-only in this phase)
6. Upload a profile photo (S3 placeholder — store URL only, no real S3 yet)

This phase is **barber-only**. Clients cannot book yet (that's Phase 3). But all the barber data that clients will search is created here.

---

## DATABASE CHANGES NEEDED

### New Migration: `003_barber_schedule.ts`

Add a recurring weekly schedule table so barbers define when they work each week, and the system generates slots automatically.

```sql
-- Weekly schedule template (Mon=1, Tue=2, ..., Sun=7)
CREATE TABLE barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT start_before_end CHECK (start_time < end_time),
  CONSTRAINT valid_slot_duration CHECK (slot_duration_minutes IN (15, 30, 45, 60)),
  UNIQUE (barber_id, day_of_week)
);

CREATE INDEX idx_barber_schedules_barber_id ON barber_schedules(barber_id);
CREATE INDEX idx_barber_schedules_day_of_week ON barber_schedules(day_of_week);

-- Blocked dates (barber is unavailable, e.g. vacation)
CREATE TABLE barber_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (barber_id, blocked_date)
);

CREATE INDEX idx_barber_blocked_dates_barber_id ON barber_blocked_dates(barber_id);
CREATE INDEX idx_barber_blocked_dates_date ON barber_blocked_dates(blocked_date);
```

---

## ENDPOINTS TO BUILD

All barber profile and management endpoints require:

- Valid JWT (`authenticateToken` middleware)
- User must be `BARBER` type (`requireRole('BARBER')`) unless noted otherwise

---

### GROUP 1: Barber Profile Management

#### `GET /barbers/me`

Get the authenticated barber's full profile.

```
Authorization: Bearer {accessToken}

Response 200:
{
  "id": "uuid",
  "userId": "uuid",
  "businessName": "Marcus's Cuts",
  "bio": "10 years experience...",
  "yearsOfExperience": 10,
  "averageRating": 4.8,
  "totalReviews": 47,
  "totalClients": 120,
  "profilePhotoUrl": "https://...",
  "address": "123 Main St",
  "city": "Brooklyn",
  "state": "NY",
  "zipCode": "11201",
  "latitude": 40.6782,
  "longitude": -73.9442,
  "subscriptionTier": "PREMIUM",
  "isVerified": false,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}

Response 404:
{
  "error": "BARBER_PROFILE_NOT_FOUND",
  "message": "Barber profile does not exist. Create one first.",
  "statusCode": 404
}
```

#### `POST /barbers/me/profile`

Create barber profile (called once after barber registers).

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "businessName": "Marcus's Cuts",
  "bio": "10 years experience specializing in fades and tapers.",
  "yearsOfExperience": 10,
  "address": "123 Main St",
  "city": "Brooklyn",
  "state": "NY",
  "zipCode": "11201",
  "latitude": 40.6782,
  "longitude": -73.9442
}

Response 201:
{
  "id": "uuid",
  "userId": "uuid",
  "businessName": "Marcus's Cuts",
  "bio": "...",
  "subscriptionTier": "FREE",
  "isVerified": false,
  "createdAt": "..."
}

Response 409:
{
  "error": "PROFILE_ALREADY_EXISTS",
  "message": "Barber profile already exists. Use PATCH to update.",
  "statusCode": 409
}
```

#### `PATCH /barbers/me/profile`

Update barber profile fields (partial update).

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request (all fields optional):
{
  "businessName": "Marcus Premium Cuts",
  "bio": "Updated bio...",
  "yearsOfExperience": 11,
  "address": "456 New St",
  "city": "Manhattan",
  "state": "NY",
  "zipCode": "10001",
  "latitude": 40.7128,
  "longitude": -74.0060
}

Response 200: updated barber profile object

Response 404:
{
  "error": "BARBER_PROFILE_NOT_FOUND",
  "message": "Create your profile first using POST /barbers/me/profile",
  "statusCode": 404
}
```

#### `POST /barbers/me/photo`

Upload profile photo. In this phase, accept a URL string (real S3 upload comes in Phase 5 with frontend). Just validate and store the URL.

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "photoUrl": "https://example.com/photo.jpg"
}

Response 200:
{
  "profilePhotoUrl": "https://example.com/photo.jpg",
  "message": "Profile photo updated."
}
```

---

### GROUP 2: Service Management

#### `POST /barbers/me/services`

Create a new service.

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "name": "Classic Fade",
  "description": "Clean fade with razor edge line up",
  "price": 25.00,
  "durationMinutes": 45,
  "category": "haircut"
}

Validation rules:
- name: required, 1-255 chars
- price: required, > 0, max 2 decimal places
- durationMinutes: required, must be one of [15, 30, 45, 60, 90, 120]
- category: required, must be one of ["haircut", "beard", "shave", "combo", "kids", "other"]
- description: optional, max 1000 chars

Response 201:
{
  "id": "uuid",
  "barberId": "uuid",
  "name": "Classic Fade",
  "description": "Clean fade with razor edge line up",
  "price": 25.00,
  "durationMinutes": 45,
  "category": "haircut",
  "isActive": true,
  "createdAt": "..."
}

Response 400:
{
  "error": "VALIDATION_ERROR",
  "message": "Price must be greater than 0",
  "statusCode": 400
}

Response 403:
{
  "error": "SERVICE_LIMIT_REACHED",
  "message": "FREE tier allows up to 5 services. Upgrade to add more.",
  "statusCode": 403
}
```

#### `GET /barbers/me/services`

List all of the authenticated barber's services.

```
Authorization: Bearer {accessToken}

Query params:
- active: boolean (optional, filter by is_active)
- category: string (optional, filter by category)

Response 200:
{
  "services": [
    {
      "id": "uuid",
      "name": "Classic Fade",
      "description": "...",
      "price": 25.00,
      "durationMinutes": 45,
      "category": "haircut",
      "isActive": true,
      "createdAt": "..."
    },
    ...
  ],
  "total": 5
}
```

#### `GET /barbers/me/services/:serviceId`

Get a specific service by ID (must belong to authenticated barber).

```
Authorization: Bearer {accessToken}

Response 200: service object

Response 404:
{
  "error": "SERVICE_NOT_FOUND",
  "message": "Service not found.",
  "statusCode": 404
}
```

#### `PATCH /barbers/me/services/:serviceId`

Update a service (partial update).

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request (all fields optional):
{
  "name": "Premium Fade",
  "price": 30.00,
  "isActive": false
}

Response 200: updated service object

Response 404: service not found
Response 403: service belongs to different barber
```

#### `DELETE /barbers/me/services/:serviceId`

Soft delete a service (sets is_active = false). Do not hard delete — appointments may reference it.

```
Authorization: Bearer {accessToken}

Response 200:
{
  "message": "Service deactivated successfully.",
  "serviceId": "uuid"
}

Note: This is a soft delete. Set is_active = false, do NOT remove the row.
```

---

### GROUP 3: Schedule & Availability Management

#### `GET /barbers/me/schedule`

Get the barber's weekly recurring schedule.

```
Authorization: Bearer {accessToken}

Response 200:
{
  "schedule": [
    {
      "id": "uuid",
      "dayOfWeek": 1,
      "dayName": "Monday",
      "startTime": "09:00",
      "endTime": "18:00",
      "slotDurationMinutes": 30,
      "isActive": true
    },
    {
      "id": "uuid",
      "dayOfWeek": 2,
      "dayName": "Tuesday",
      "startTime": "09:00",
      "endTime": "18:00",
      "slotDurationMinutes": 30,
      "isActive": true
    }
    // ... up to 7 days
  ]
}
```

#### `PUT /barbers/me/schedule`

Set or replace the full weekly schedule (upsert by day_of_week).

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "schedule": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "18:00",
      "slotDurationMinutes": 30,
      "isActive": true
    },
    {
      "dayOfWeek": 2,
      "startTime": "09:00",
      "endTime": "18:00",
      "slotDurationMinutes": 30,
      "isActive": true
    },
    {
      "dayOfWeek": 6,
      "startTime": "10:00",
      "endTime": "15:00",
      "slotDurationMinutes": 30,
      "isActive": true
    }
    // Only include days they work — omitted days mean closed
  ]
}

Validation:
- dayOfWeek: 1-7 (1=Monday, 7=Sunday)
- startTime/endTime: "HH:MM" format, 24-hour
- startTime must be before endTime
- slotDurationMinutes: 15, 30, 45, or 60

Response 200:
{
  "message": "Schedule updated successfully.",
  "schedule": [...] // full updated schedule
}
```

#### `GET /barbers/me/slots`

Get generated availability slots for a date range.

```
Authorization: Bearer {accessToken}

Query params:
- startDate: YYYY-MM-DD (required)
- endDate: YYYY-MM-DD (required, max 30 days from startDate)

Response 200:
{
  "slots": [
    {
      "id": "uuid",
      "date": "2024-01-20",
      "dayName": "Saturday",
      "startTime": "09:00",
      "endTime": "09:30",
      "status": "AVAILABLE"
    },
    {
      "id": "uuid",
      "date": "2024-01-20",
      "startTime": "09:30",
      "endTime": "10:00",
      "status": "BOOKED"
    },
    ...
  ],
  "summary": {
    "totalSlots": 48,
    "available": 32,
    "booked": 14,
    "blocked": 2
  }
}
```

#### `POST /barbers/me/slots/generate`

Generate availability slots from the weekly schedule for a date range. This should be called after setting a schedule to populate the `availability_slots` table.

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "startDate": "2024-01-20",
  "endDate": "2024-02-20"
}

Logic:
1. Read the barber's schedule (barber_schedules table)
2. For each day in the date range:
   a. Find the schedule entry for that day_of_week
   b. If schedule exists and is_active:
      - Generate slots from startTime to endTime in increments of slotDurationMinutes
      - Skip if a slot already exists for that barber/date/time (idempotent)
      - Skip if date is in barber_blocked_dates
3. Insert all generated slots into availability_slots table

Example: Schedule says Mon 09:00-11:00, 30-min slots
→ Generate: 09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00

Response 200:
{
  "message": "Slots generated successfully.",
  "generated": 48,
  "skipped": 5,
  "dateRange": {
    "start": "2024-01-20",
    "end": "2024-02-20"
  }
}
```

#### `POST /barbers/me/blocked-dates`

Block a specific date (barber is unavailable, e.g. vacation).

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "date": "2024-02-14",
  "reason": "Valentine's Day holiday"
}

Response 201:
{
  "id": "uuid",
  "date": "2024-02-14",
  "reason": "Valentine's Day holiday",
  "message": "Date blocked. Existing available slots for this date will be cancelled."
}

Side effect: Mark any AVAILABLE slots for this barber on this date as BLOCKED.
```

#### `DELETE /barbers/me/blocked-dates/:date`

Unblock a previously blocked date.

```
Authorization: Bearer {accessToken}

Param: date in YYYY-MM-DD format

Response 200:
{
  "message": "Date unblocked.",
  "date": "2024-02-14"
}

Side effect: Re-generate slots for this date from schedule (if schedule exists).
```

---

### GROUP 4: Barber Appointment Overview

#### `GET /barbers/me/appointments`

List the barber's appointments (read-only in this phase).

```
Authorization: Bearer {accessToken}

Query params:
- status: PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW (optional)
- date: YYYY-MM-DD (optional, filter by specific date)
- startDate: YYYY-MM-DD (optional)
- endDate: YYYY-MM-DD (optional)
- page: number (default 1)
- limit: number (default 20, max 50)

Response 200:
{
  "appointments": [
    {
      "id": "uuid",
      "scheduledAt": "2024-01-20T10:00:00Z",
      "durationMinutes": 45,
      "status": "CONFIRMED",
      "paymentStatus": "PENDING",
      "priceQuoted": 25.00,
      "service": {
        "id": "uuid",
        "name": "Classic Fade"
      },
      "client": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890"
      },
      "clientNotes": "Please make it extra clean on the sides"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

#### `PATCH /barbers/me/appointments/:appointmentId/status`

Barber updates appointment status (confirm, complete, mark no-show).

```
Authorization: Bearer {accessToken}
Content-Type: application/json

Request:
{
  "status": "CONFIRMED",
  "notes": "See you then!" // optional barber notes
}

Allowed transitions by barber:
- PENDING → CONFIRMED
- PENDING → CANCELLED
- CONFIRMED → IN_PROGRESS
- IN_PROGRESS → COMPLETED
- CONFIRMED → NO_SHOW

Response 200:
{
  "id": "uuid",
  "status": "CONFIRMED",
  "updatedAt": "..."
}

Response 400:
{
  "error": "INVALID_STATUS_TRANSITION",
  "message": "Cannot transition from COMPLETED to PENDING.",
  "statusCode": 400
}
```

---

### GROUP 5: Public Barber Profile (No Auth Required)

These are read-only endpoints for clients to view barbers. No authentication required.

#### `GET /barbers/:barberId`

Get a barber's public profile.

```
No auth required

Response 200:
{
  "id": "uuid",
  "businessName": "Marcus's Cuts",
  "bio": "10 years experience...",
  "yearsOfExperience": 10,
  "averageRating": 4.8,
  "totalReviews": 47,
  "profilePhotoUrl": "https://...",
  "city": "Brooklyn",
  "state": "NY",
  "subscriptionTier": "PREMIUM",
  "isVerified": true
}

Note: Do NOT expose latitude/longitude, stripe account, or internal fields.
```

#### `GET /barbers/:barberId/services`

Get a barber's active services (public).

```
No auth required

Response 200:
{
  "services": [
    {
      "id": "uuid",
      "name": "Classic Fade",
      "description": "...",
      "price": 25.00,
      "durationMinutes": 45,
      "category": "haircut"
    }
  ]
}

Note: Only return is_active = true services.
```

#### `GET /barbers/:barberId/slots`

Get a barber's available slots for a date range (public, for client booking).

```
No auth required

Query params:
- date: YYYY-MM-DD (optional, defaults to today)
- days: number of days to show (default 7, max 30)

Response 200:
{
  "slots": [
    {
      "id": "uuid",
      "date": "2024-01-20",
      "startTime": "09:00",
      "endTime": "09:30",
      "isAvailable": true
    },
    {
      "id": "uuid",
      "date": "2024-01-20",
      "startTime": "09:30",
      "endTime": "10:00",
      "isAvailable": false  // already booked
    }
  ]
}

Note: Only return AVAILABLE and BOOKED statuses. Do not reveal client info.
```

---

## FILE STRUCTURE TO CREATE

```
apps/api/src/
│
├── routes/
│   ├── barbers.ts                       ← NEW: all barber routes
│   └── index.ts                         ← UPDATE: register barber routes
│
├── services/
│   └── barber/                          ← NEW folder
│       ├── barberProfileService.ts      ← Profile CRUD
│       ├── barberServiceService.ts      ← Service CRUD (naming: think carefully)
│       ├── barberScheduleService.ts     ← Schedule + slot generation logic
│       └── barberAppointmentService.ts  ← Appointment queries for barbers
│
├── db/
│   ├── migrations/
│   │   └── 003_barber_schedule.ts       ← NEW: barber_schedules, blocked_dates
│   └── queries/
│       └── barber.queries.ts            ← NEW: reusable DB queries
│
└── utils/
    └── slotGenerator.ts                 ← NEW: slot generation utility

packages/shared-types/src/
├── barber.ts                            ← NEW: Zod schemas for barber endpoints
└── index.ts                             ← UPDATE: export barber types
```

---

## TYPES TO ADD

```typescript
// packages/shared-types/src/barber.ts

import { z } from 'zod';

const SERVICE_CATEGORIES = ['haircut', 'beard', 'shave', 'combo', 'kids', 'other'] as const;
const VALID_SLOT_DURATIONS = [15, 30, 45, 60, 90, 120] as const;
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

// Profile
export const CreateBarberProfileSchema = z.object({
  businessName: z.string().min(1).max(255),
  bio: z.string().max(1000).optional(),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type CreateBarberProfileRequest = z.infer<typeof CreateBarberProfileSchema>;

export const UpdateBarberProfileSchema = CreateBarberProfileSchema.partial();
export type UpdateBarberProfileRequest = z.infer<typeof UpdateBarberProfileSchema>;

// Services
export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  price: z.number().positive().multipleOf(0.01),
  durationMinutes: z.number().refine((v) => VALID_SLOT_DURATIONS.includes(v as any)),
  category: z.enum(SERVICE_CATEGORIES),
});
export type CreateServiceRequest = z.infer<typeof CreateServiceSchema>;

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateServiceRequest = z.infer<typeof UpdateServiceSchema>;

// Schedule
export const ScheduleEntrySchema = z.object({
  dayOfWeek: z.number().refine((v) => DAYS_OF_WEEK.includes(v as any)),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM 24hr
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  slotDurationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  isActive: z.boolean().default(true),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

export const SetScheduleSchema = z.object({
  schedule: z.array(ScheduleEntrySchema).min(1).max(7),
});
export type SetScheduleRequest = z.infer<typeof SetScheduleSchema>;

// Slot generation
export const GenerateSlotsSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    },
    { message: 'Date range must be between 0 and 30 days' },
  );

// Appointment status update
export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW']),
  notes: z.string().max(1000).optional(),
});
```

---

## BUSINESS LOGIC REQUIREMENTS

### Slot Generation Logic (`utils/slotGenerator.ts`)

This is the core algorithm. Implement carefully:

```typescript
/**
 * Given a barber's schedule entry for a day, generate all time slots.
 *
 * Example:
 * - startTime: "09:00"
 * - endTime: "17:00"
 * - slotDurationMinutes: 30
 *
 * Result: [
 *   { start: "09:00", end: "09:30" },
 *   { start: "09:30", end: "10:00" },
 *   ...
 *   { start: "16:30", end: "17:00" }
 * ]
 *
 * IMPORTANT: The last slot must end exactly at endTime.
 * Do NOT generate a slot that would end after endTime.
 */
function generateDaySlots(
  startTime: string, // "HH:MM"
  endTime: string, // "HH:MM"
  slotDuration: number, // minutes
): Array<{ startTime: string; endTime: string }>;
```

### Service Tier Limits

```typescript
const SERVICE_LIMITS_BY_TIER = {
  FREE: 5,
  BASIC: 20,
  PREMIUM: Infinity,
};
```

### Appointment Status Transitions

Only these transitions are valid for barbers:

```typescript
const BARBER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED'],
};
// COMPLETED, CANCELLED, NO_SHOW are terminal states — no transitions out
```

### Soft Delete Services

When a service is "deleted", set `is_active = false`. Never remove the row because appointments reference it.

### Blocking a Date

When a barber blocks a date:

1. Insert into `barber_blocked_dates`
2. Update all `AVAILABLE` slots for that barber on that date to `BLOCKED`
3. Do NOT affect `BOOKED` slots (those have confirmed appointments)

---

## ENVIRONMENT VARIABLES (No Changes Needed)

Phase 2 uses existing env vars only. No new variables required.

---

## SEED DATA UPDATES

Update `apps/api/src/db/seeds/seed.ts` to also seed:

1. **Barber schedules** — each of the 3 seeded barbers should have a typical schedule:
   - Barber 1: Mon-Fri 9am-5pm, 30-min slots
   - Barber 2: Tue-Sat 10am-6pm, 30-min slots
   - Barber 3: Wed-Sun 11am-7pm, 45-min slots

2. **Availability slots** — generate ~2 weeks of slots from those schedules
   - Mix of AVAILABLE, BOOKED (matching existing appointments), and a couple of BLOCKED

3. **Blocked date** — each barber should have 1 blocked date in the future

4. **Verify existing seeds are consistent** — services already exist, just verify they match barber IDs correctly

---

## SUCCESS CRITERIA

After Phase 2 is implemented, all of these must work:

```bash
# --- SETUP: Login as barber first ---
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"barber1@example.com","password":"password123"}' \
  | jq -r '.accessToken')


# 1. Get my barber profile
curl -s http://localhost:3000/barbers/me \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expect: 200 with barber profile object


# 2. Update my profile
curl -s -X PATCH http://localhost:3000/barbers/me/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"Updated bio","city":"Brooklyn"}' | jq .
# Expect: 200 with updated profile


# 3. Create a service
curl -s -X POST http://localhost:3000/barbers/me/services \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Premium Fade","description":"Top quality fade","price":35.00,"durationMinutes":45,"category":"haircut"}' | jq .
# Expect: 201 with service object


# 4. List my services
curl -s http://localhost:3000/barbers/me/services \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expect: 200 with array of services


# 5. Update a service (use ID from step 3)
curl -s -X PATCH http://localhost:3000/barbers/me/services/{SERVICE_ID} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":40.00}' | jq .
# Expect: 200 with updated service


# 6. Get my schedule
curl -s http://localhost:3000/barbers/me/schedule \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expect: 200 with schedule array (seeded data)


# 7. Set a new schedule
curl -s -X PUT http://localhost:3000/barbers/me/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": [
      {"dayOfWeek":1,"startTime":"09:00","endTime":"17:00","slotDurationMinutes":30,"isActive":true},
      {"dayOfWeek":2,"startTime":"09:00","endTime":"17:00","slotDurationMinutes":30,"isActive":true},
      {"dayOfWeek":5,"startTime":"10:00","endTime":"14:00","slotDurationMinutes":30,"isActive":true}
    ]
  }' | jq .
# Expect: 200 with updated schedule


# 8. Generate slots for next 14 days
START=$(date +%Y-%m-%d)
END=$(date -d "+14 days" +%Y-%m-%d 2>/dev/null || date -v+14d +%Y-%m-%d)
curl -s -X POST http://localhost:3000/barbers/me/slots/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"startDate\":\"$START\",\"endDate\":\"$END\"}" | jq .
# Expect: 200 with count of generated slots


# 9. View my slots
curl -s "http://localhost:3000/barbers/me/slots?startDate=$START&endDate=$END" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expect: 200 with slots array and summary


# 10. Block a date
curl -s -X POST http://localhost:3000/barbers/me/blocked-dates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-12-25","reason":"Christmas holiday"}' | jq .
# Expect: 201 with blocked date record


# 11. View my appointments
curl -s http://localhost:3000/barbers/me/appointments \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expect: 200 with paginated appointments list


# 12. Public barber profile (NO AUTH)
BARBER_ID=$(curl -s http://localhost:3000/barbers/me \
  -H "Authorization: Bearer $TOKEN" | jq -r '.id')

curl -s http://localhost:3000/barbers/$BARBER_ID | jq .
# Expect: 200 with public profile (no sensitive fields)


# 13. Public services (NO AUTH)
curl -s http://localhost:3000/barbers/$BARBER_ID/services | jq .
# Expect: 200 with active services list


# 14. Public slots (NO AUTH)
curl -s "http://localhost:3000/barbers/$BARBER_ID/slots?date=$START" | jq .
# Expect: 200 with available slots (no client info)


# 15. Client cannot access barber management routes
CLIENT_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client1@example.com","password":"password123"}' \
  | jq -r '.accessToken')

curl -s -X POST http://localhost:3000/barbers/me/services \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":10,"durationMinutes":30,"category":"haircut"}' | jq .
# Expect: 403 Forbidden


# 16. Typecheck still passes
pnpm typecheck
# Expect: 0 errors


# 17. Lint still passes
pnpm lint
# Expect: 0 errors
```

---

## DELIVERABLES CHECKLIST

### Routes

- [ ] `POST /barbers/me/profile` — create profile
- [ ] `GET /barbers/me` — get my profile
- [ ] `PATCH /barbers/me/profile` — update profile
- [ ] `POST /barbers/me/photo` — set profile photo URL
- [ ] `POST /barbers/me/services` — create service
- [ ] `GET /barbers/me/services` — list services
- [ ] `GET /barbers/me/services/:id` — get service
- [ ] `PATCH /barbers/me/services/:id` — update service
- [ ] `DELETE /barbers/me/services/:id` — soft delete service
- [ ] `GET /barbers/me/schedule` — get schedule
- [ ] `PUT /barbers/me/schedule` — set schedule
- [ ] `GET /barbers/me/slots` — view slots
- [ ] `POST /barbers/me/slots/generate` — generate slots
- [ ] `POST /barbers/me/blocked-dates` — block a date
- [ ] `DELETE /barbers/me/blocked-dates/:date` — unblock a date
- [ ] `GET /barbers/me/appointments` — list appointments
- [ ] `PATCH /barbers/me/appointments/:id/status` — update status
- [ ] `GET /barbers/:barberId` — public profile
- [ ] `GET /barbers/:barberId/services` — public services
- [ ] `GET /barbers/:barberId/slots` — public slots

### Services

- [ ] `barberProfileService.ts`
- [ ] `barberServiceService.ts`
- [ ] `barberScheduleService.ts`
- [ ] `barberAppointmentService.ts`

### Utilities

- [ ] `slotGenerator.ts` — slot generation algorithm

### Database

- [ ] Migration `003_barber_schedule.ts`
- [ ] Updated seed data

### Types

- [ ] `packages/shared-types/src/barber.ts`
- [ ] Updated exports in `index.ts`

### Documentation

- [ ] `docs/API.md` updated with all Phase 2 endpoints
- [ ] One section in `docs/BARBERS.md` (new file) explaining how schedule → slots works

---

## IMPORTANT IMPLEMENTATION NOTES

1. **`requireRole('BARBER')` middleware already exists** — use it on all `/barbers/me/*` routes.

2. **Service naming collision** — The folder is `services/barber/` and the entity is also called "service". Name the file `barberOffering.ts` or `barberServiceItem.ts` if `barberServiceService.ts` feels too confusing. Your choice, just be consistent.

3. **Slot generation is idempotent** — Running it twice for the same date range should not create duplicate slots. Use an upsert or check for existing before inserting.

4. **Public endpoints use the same barber_id UUID** — the ID in `GET /barbers/:barberId` is the `barber_profiles.id`, not the `users.id`. Make sure to clarify this in responses.

5. **Pagination on appointments** — Use `page` and `limit` query params. Always return `pagination` metadata in the response.

6. **Price storage** — prices are stored as `DECIMAL(10,2)` in the database. Return them as numbers (not strings) in JSON responses.

7. **Time format** — Store times as `TIME` in Postgres. Return them as `"HH:MM"` strings in JSON. No timezone conversion needed — barbers set local times.

8. **Don't break existing tests** — `GET /health`, `GET /`, and all `/auth/*` routes must still work after Phase 2.

---

## WHAT'S NOT IN SCOPE (PHASE 3+)

- ❌ Clients searching for barbers (Phase 3)
- ❌ Clients booking appointments (Phase 3)
- ❌ Payment processing (Phase 4)
- ❌ Real S3 file uploads (Phase 5 with frontend)
- ❌ Real-time slot updates via WebSocket (Phase 7)
- ❌ Push notifications when booked (Phase 7)
- ❌ Analytics/dashboard stats (Phase 8)
- ❌ AI pricing suggestions (Phase 9)

---

## RESPONSE FORMAT

When done, provide:

1. **Summary** — 5-line overview of what was built
2. **New files** — complete list with paths
3. **Modified files** — list with what changed
4. **Migration** — show the migration file
5. **Key service implementations** — show slot generator and main business logic
6. **All curl tests with expected output** — copy-paste ready

---

**Phase 2 is the core business value of the platform. Every barber feature depends on this. Build it solid. 🚀**
