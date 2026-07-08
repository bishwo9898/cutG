# BARBER SAAS PLATFORM - PHASE 0: PROJECT FOUNDATION & DATABASE SETUP

## Prompt for Claude Sonnet (Optimized for Efficiency)

---

## CONTEXT & PROJECT OVERVIEW

You are building the **foundation** for a comprehensive SaaS platform that helps barbers manage their operations and clients. This is Phase 0 - the most critical phase.

### What This Platform Does

- **For Barbers**: Manage their online presence, services, availability, client bookings, earnings
- **For Clients**: Discover barbers, book appointments, pay online, leave reviews
- **Features**: Appointment scheduling, real-time slot updates, payments (Stripe), subscriptions, future AI integration

### Why This Matters

A strong foundation now prevents massive rewrites later. This phase sets up:

- Database schema (the backbone of everything)
- Type-safe infrastructure
- Project structure (monorepo, deployable)
- Development environment (reproducible)

---

## YOUR OBJECTIVE (READ CAREFULLY)

**Create a production-ready project foundation with:**

1. **Monorepo structure** (pnpm workspaces) organized for web, mobile, and backend
2. **PostgreSQL schema** with all core tables for barber SaaS
3. **Type definitions** (TypeScript) mirroring the database
4. **Sample seed data** (realistic test data)
5. **Migration scripts** for reproducible schema setup
6. **Docker setup** (Docker Compose) for instant local development
7. **Basic project configuration** (ESLint, TypeScript, .env templates)
8. **Comprehensive documentation** explaining the structure

---

## TECHNOLOGY STACK (LOCKED IN)

- **Backend**: Node.js 18+ with Express.js
- **Database**: PostgreSQL 14+
- **Package Manager**: pnpm with workspaces
- **Language**: TypeScript (strict mode)
- **Migrations**: Knex.js
- **Containerization**: Docker + Docker Compose
- **Validation**: Zod for runtime validation
- **IDE**: VSCode-compatible (tsconfig, prettier config provided)

---

## PROJECT STRUCTURE (CREATE EXACTLY THIS)

```
barber-saas/
├── docker-compose.yml                 # Local dev environment
├── .env.example                       # Template for environment variables
├── .gitignore
├── pnpm-workspace.yaml                # Monorepo configuration
├── tsconfig.json                      # Shared TypeScript config
├── .prettierrc                        # Code formatting
├── .eslintrc.json                     # Linting rules
│
├── apps/
│   ├── api/                          # Backend API (Express)
│   │   ├── src/
│   │   │   ├── index.ts              # Server entry point
│   │   │   ├── config/
│   │   │   │   ├── database.ts       # PostgreSQL connection
│   │   │   │   └── env.ts            # Environment validation
│   │   │   ├── db/
│   │   │   │   ├── migrations/       # Knex migration files
│   │   │   │   └── seeds/            # Seed data
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT validation (placeholder)
│   │   │   │   └── errorHandler.ts   # Global error handling
│   │   │   ├── routes/
│   │   │   │   ├── health.ts         # Health check endpoint
│   │   │   │   └── index.ts          # Route aggregation
│   │   │   └── utils/
│   │   │       └── logger.ts         # Logging utility
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── web/                          # Next.js Web App (placeholder structure)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                       # React Native/Expo (placeholder structure)
│       ├── src/
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/                 # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── schema.ts             # Zod schemas & TS types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared-utils/                 # Shared utilities (validators, helpers)
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
└── docs/
    ├── DATABASE.md                   # Schema documentation
    ├── API.md                        # API design (placeholder)
    └── SETUP.md                      # Developer setup guide
```

---

## POSTGRESQL SCHEMA REQUIREMENTS

You must create a **comprehensive, production-ready** PostgreSQL schema with the following tables:

### 1. **users** (Base table for all users)

```
- id (UUID, primary key)
- email (VARCHAR, unique)
- password_hash (VARCHAR)
- phone (VARCHAR)
- first_name (VARCHAR)
- last_name (VARCHAR)
- user_type (ENUM: BARBER, CLIENT, ADMIN)
- is_active (BOOLEAN, default true)
- email_verified (BOOLEAN, default false)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP, nullable - soft delete)

Indexes:
- email (unique)
- user_type
- created_at
```

### 2. **barber_profiles** (Extended profile for barbers)

```
- id (UUID, primary key)
- user_id (UUID, foreign key → users)
- business_name (VARCHAR)
- bio (TEXT)
- rating (DECIMAL(3,2), default 0, range 0-5)
- total_reviews (INTEGER, default 0)
- total_clients (INTEGER, default 0)
- profile_photo_url (VARCHAR, nullable)
- latitude (DECIMAL(10,8), nullable - for location)
- longitude (DECIMAL(11,8), nullable)
- address (TEXT, nullable)
- city (VARCHAR, nullable)
- state (VARCHAR, nullable)
- zip_code (VARCHAR, nullable)
- years_of_experience (INTEGER, nullable)
- stripe_account_id (VARCHAR, nullable)
- subscription_tier (ENUM: FREE, BASIC, PREMIUM, default FREE)
- subscription_valid_until (TIMESTAMP, nullable)
- is_verified (BOOLEAN, default false)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- user_id (unique)
- rating DESC (for top barbers)
- created_at
```

### 3. **services** (Haircut services offered by barbers)

```
- id (UUID, primary key)
- barber_id (UUID, foreign key → barber_profiles)
- name (VARCHAR) - e.g., "Classic Haircut", "Fade with Line-up"
- description (TEXT, nullable)
- price (DECIMAL(10,2))
- duration_minutes (INTEGER) - e.g., 30, 45, 60
- is_active (BOOLEAN, default true)
- service_category (VARCHAR) - e.g., "haircut", "beard", "shave"
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- barber_id
- is_active
- service_category
```

### 4. **time_slots** (Barber availability)

```
- id (UUID, primary key)
- barber_id (UUID, foreign key → barber_profiles)
- date (DATE)
- start_time (TIME) - e.g., 09:00
- end_time (TIME) - e.g., 17:00
- is_booked (BOOLEAN, default false)
- duration_minutes (INTEGER) - calculated based on service
- created_at (TIMESTAMP)

Indexes:
- barber_id, date (composite)
- is_booked
```

### 5. **appointments** (Bookings)

```
- id (UUID, primary key)
- client_id (UUID, foreign key → users)
- barber_id (UUID, foreign key → barber_profiles)
- service_id (UUID, foreign key → services, nullable)
- time_slot_id (UUID, foreign key → time_slots, nullable)
- scheduled_at (TIMESTAMP) - actual appointment time
- duration_minutes (INTEGER)
- status (ENUM: PENDING, CONFIRMED, COMPLETED, CANCELLED, default PENDING)
- client_notes (TEXT, nullable)
- barber_notes (TEXT, nullable)
- location_address (TEXT)
- payment_status (ENUM: PENDING, COMPLETED, REFUNDED, default PENDING)
- appointment_price (DECIMAL(10,2))
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- completed_at (TIMESTAMP, nullable)

Indexes:
- client_id, scheduled_at
- barber_id, scheduled_at
- status
- payment_status
```

### 6. **payments** (Stripe payment records)

```
- id (UUID, primary key)
- appointment_id (UUID, foreign key → appointments)
- client_id (UUID, foreign key → users)
- barber_id (UUID, foreign key → barber_profiles)
- amount (DECIMAL(10,2))
- currency (VARCHAR, default USD)
- stripe_payment_intent_id (VARCHAR, unique, nullable)
- stripe_charge_id (VARCHAR, unique, nullable)
- status (ENUM: PENDING, SUCCEEDED, FAILED, REFUNDED, default PENDING)
- error_message (TEXT, nullable)
- refund_amount (DECIMAL(10,2), nullable)
- refund_reason (VARCHAR, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- appointment_id (unique)
- stripe_payment_intent_id
- status
- created_at
```

### 7. **subscriptions** (Barber subscription management)

```
- id (UUID, primary key)
- barber_id (UUID, foreign key → barber_profiles)
- tier (ENUM: FREE, BASIC, PREMIUM)
- stripe_subscription_id (VARCHAR, unique, nullable)
- status (ENUM: ACTIVE, CANCELLED, EXPIRED, default ACTIVE)
- billing_cycle_start (TIMESTAMP)
- billing_cycle_end (TIMESTAMP)
- renewal_date (TIMESTAMP)
- auto_renew (BOOLEAN, default true)
- features (JSONB) - e.g., { "max_slots": 100, "analytics": true }
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- barber_id (unique)
- tier
- status
```

### 8. **reviews** (Client reviews & ratings)

```
- id (UUID, primary key)
- appointment_id (UUID, foreign key → appointments, unique)
- client_id (UUID, foreign key → users)
- barber_id (UUID, foreign key → barber_profiles)
- rating (INTEGER, range 1-5)
- title (VARCHAR, nullable)
- comment (TEXT, nullable)
- is_verified_appointment (BOOLEAN, default true)
- helpful_count (INTEGER, default 0)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- barber_id, created_at DESC (for recent reviews)
- rating
- appointment_id (unique)
```

### 9. **notifications** (Notification queue)

```
- id (UUID, primary key)
- user_id (UUID, foreign key → users)
- type (ENUM: APPOINTMENT_CONFIRMED, REMINDER, REVIEW_REQUEST, PROMOTION, SYSTEM)
- title (VARCHAR)
- message (TEXT)
- data (JSONB, nullable) - contextual data (appointment_id, etc)
- is_read (BOOLEAN, default false)
- read_at (TIMESTAMP, nullable)
- sent_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)

Indexes:
- user_id, is_read
- type
- created_at DESC
```

---

## DELIVERABLES (EXACT REQUIREMENTS)

### 1. **Database Schema Files**

- [ ] `apps/api/src/db/migrations/001_initial_schema.ts` (Knex migration)
  - Must include all 9 tables above
  - All indexes, constraints, and enums
  - Clear comments explaining each table

- [ ] `apps/api/src/db/seeds/seed.ts` (Sample data)
  - 3 barber profiles with realistic data
  - 10 client users
  - 15 services (3-5 per barber)
  - 10 sample appointments (mix of statuses)
  - 5 reviews with ratings
  - Uses faker.js for realistic names/emails
  - All data is consistent (barber_id matches services, etc)

### 2. **TypeScript Type Definitions**

- [ ] `packages/shared-types/src/schema.ts`
  - Zod schemas for each table (for runtime validation)
  - TypeScript types inferred from Zod schemas
  - Example:
    ```typescript
    export const UserSchema = z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      userType: z.enum(['BARBER', 'CLIENT', 'ADMIN']),
      // ...
    });
    export type User = z.infer<typeof UserSchema>;
    ```
  - Include schemas for:
    - User, BarberProfile, Service, TimeSlot, Appointment
    - Payment, Subscription, Review, Notification

### 3. **Docker Setup**

- [ ] `docker-compose.yml`
  - PostgreSQL 14 service
  - Optional: Redis service (for later)
  - Volume for PostgreSQL data persistence
  - Environment variables mapped from .env
  - Networks configured for service communication
  - Health checks enabled

- [ ] `.env.example`
  - All required environment variables
  - Sensible defaults for local development
  - Clear comments for each variable

### 4. **Database Connection & Config**

- [ ] `apps/api/src/config/database.ts`
  - PostgreSQL connection pool setup
  - Connection validation on startup
  - Error handling for connection failures
  - Support for environment-specific configs (dev, test, prod)

- [ ] `apps/api/src/config/env.ts`
  - Environment variable validation with Zod
  - Fail fast if required vars are missing
  - Type-safe access to all env vars

### 5. **Base Express App**

- [ ] `apps/api/src/index.ts` (Server entry point)
  - Express app initialization
  - Middleware setup (CORS, JSON parser, error handler)
  - Database connection on startup
  - Health check endpoint (`GET /health`)
  - Graceful shutdown handling
  - Port configured via env var

- [ ] `apps/api/src/middleware/errorHandler.ts`
  - Global error handling middleware
  - Consistent error response format
  - Logging for errors

### 6. **NPM Scripts & Configuration**

- [ ] Root `package.json`
  - Workspaces defined
  - Common scripts: `dev`, `build`, `test`, `lint`, `db:migrate`, `db:seed`

- [ ] Each workspace has proper `package.json` with scripts:
  - `api`: `dev` (with nodemon), `build`, `start`, `db:migrate`, `db:seed`
  - `shared-types`: `build`
  - `web`: placeholder (Next.js install)
  - `mobile`: placeholder (Expo install)

### 7. **TypeScript & Linting**

- [ ] Root `tsconfig.json` (shared config)
- [ ] Each app has its own `tsconfig.json` (extends root)
- [ ] `.eslintrc.json` (ESLint configuration)
- [ ] `.prettierrc` (Code formatting)

### 8. **Documentation**

- [ ] `docs/DATABASE.md`
  - Schema overview
  - ER diagram (ASCII or Mermaid format)
  - Explanation of each table and relationships
  - Indexing strategy explained

- [ ] `docs/SETUP.md`
  - Prerequisites (Node.js version, pnpm, Docker)
  - Step-by-step local setup instructions
  - Running migrations and seeds
  - Starting the dev server
  - Troubleshooting common issues

- [ ] `docs/API.md` (Placeholder)
  - API design principles
  - Response format standards
  - Error codes
  - Example endpoints (placeholder for future)

- [ ] `README.md`
  - Project overview
  - Quick start guide
  - Project structure explanation
  - Tech stack summary

### 9. **.gitignore & Project Config**

- [ ] `.gitignore` (ignoring node_modules, build, .env, etc)
- [ ] `pnpm-workspace.yaml` (workspace configuration)

---

## CONSTRAINTS & IMPORTANT NOTES

### Code Quality Standards

- **TypeScript**: Strict mode enabled (`strict: true` in tsconfig.json)
- **No `any`**: Avoid `any` types; use proper types instead
- **Naming conventions**:
  - camelCase for variables/functions
  - PascalCase for types/classes
  - UPPER_SNAKE_CASE for constants
- **File organization**: Logical grouping by feature/responsibility
- **Comments**: Explain _why_ not _what_; code should explain what

### Naming Conventions (Database)

- **Tables**: snake_case (plural, e.g., `barber_profiles`)
- **Columns**: snake_case (e.g., `created_at`)
- **Constraints**: descriptive (e.g., `fk_appointments_barber_id`)
- **Indexes**: descriptive (e.g., `idx_appointments_barber_id_scheduled_at`)

### Git Workflow

- Create a `.gitignore` that excludes:
  - `node_modules/`
  - `.env` (not .env.example)
  - `dist/`, `build/`
  - `.DS_Store`
  - IDE-specific files

---

## WHAT NOT TO INCLUDE (SKIP FOR NOW)

❌ Authentication endpoints (coming in Phase 1)  
❌ API route handlers for appointments/services (Phase 1)  
❌ React components or frontend code  
❌ Stripe integration (Phase 3)  
❌ Real-time features (Phase 5)  
❌ Admin features  
❌ Email/SMS integration  
❌ Testing suites (optional, can add in Phase 2)

**This is FOUNDATION only.**

---

## SUCCESS CRITERIA

After you complete this, I should be able to:

1. Clone the repo and run `docker-compose up` → PostgreSQL starts
2. Run `pnpm install` → All dependencies installed
3. Run `pnpm db:migrate` → Schema is created in PostgreSQL
4. Run `pnpm db:seed` → 3 barbers, 10 clients, 15 services, 10 appointments loaded
5. Run `pnpm dev` (from apps/api) → Express server starts on port 3000
6. `curl http://localhost:3000/health` → Returns `{ status: "ok" }`
7. Open `docs/DATABASE.md` → Understand the complete schema
8. Look at `packages/shared-types/src/schema.ts` → See all TypeScript types
9. Check `apps/api/src/config/database.ts` → See how connection is managed
10. **Zero warnings** when running `pnpm lint`
11. **All TypeScript** compiles cleanly with no `any` types

---

## ADDITIONAL INSTRUCTIONS

### For File Generation

- Include file paths in your response
- Include brief comments explaining complex logic
- Make the code production-ready (error handling, logging, etc)
- Use meaningful variable names (no single-letter vars except loops)

### For Docker

- Use specific image versions (not `latest`)
- Include comments explaining why each config is there
- Make sure volumes persist data between restarts

### For Documentation

- Write it as if for another developer joining the team
- Include examples where helpful
- Explain design decisions (why this schema structure, why these indexes)

### For Seeds

- Make data realistic (use faker.js)
- Create relationships that make sense (barber has services, appointments reference valid services)
- Add timestamps as realistic (spread over past 30 days)
- Mix appointment statuses (some completed, some pending, some cancelled)

---

## OPTIONAL ENHANCEMENTS (IF TIME PERMITS)

- [ ] Add database diagram generation (SchemaCrawler or similar)
- [ ] Add pre-commit hooks to lint/format code
- [ ] Add GitHub Actions workflow for CI/CD (lint, test on push)
- [ ] Add .env validation script
- [ ] Add rollback migration example

---

## BEFORE YOU START

Make sure you have:

- ✅ Read this entire prompt
- ✅ Understood the project structure
- ✅ Noted the 9 database tables and their relationships
- ✅ Understood the deliverables checklist
- ✅ Reviewed the success criteria

---

## HOW TO SUBMIT RESULTS

When you're done, organize your response:

1. **Summary** (5 lines): What was created
2. **File Structure** (tree view): All files created
3. **Key Setup Steps**: How to run it locally
4. **Next Steps**: What Prompt #1 will build on top
5. **Notes**: Any decisions made, assumptions, gotchas

You don't need to paste entire files in the response, but do:

- Explain key design decisions
- Highlight any assumptions you made
- Flag any potential issues or TODOs

---

**You're building the foundation that everything else stands on. Take time to get this right. Good luck!**
