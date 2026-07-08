# BARBER SAAS - PHASE 1: AUTHENTICATION & USER MANAGEMENT

## Complete Implementation Prompt for Codex

---

## EXECUTIVE SUMMARY

You're building **the authentication layer** — the critical system that gates access to everything else. This phase unblocks all future features and enables secure multi-user operations.

**Why this matters:**

- ✅ Every other feature depends on authentication
- ✅ Enables team testing (different user roles)
- ✅ Foundation for payments, bookings, and admin features
- ✅ Security is non-negotiable at this stage
- ✅ JWT tokens power future real-time features

**Scope:** Authentication, registration, login, JWT, email verification, role-based middleware, profile management.

**Not in scope:** Email delivery (placeholder), 2FA, OAuth (save for later).

---

## CURRENT STATE (From Phase 0)

Your project already has:

✅ **Database Schema**: 9 tables including `users`, `barber_profiles`  
✅ **TypeScript Types**: Zod schemas in `packages/shared-types`  
✅ **Express API**: Running on port 3000 with health checks  
✅ **PostgreSQL**: Running in Docker with seed data  
✅ **Seed Data**: 3 barbers, 12 clients, all with test data  
✅ **Shared Packages**: Type definitions and validators ready to import  
✅ **Docker Setup**: Local dev environment complete

Your API structure:

```
apps/api/src/
├── index.ts                 (Express server)
├── config/
│   ├── database.ts
│   ├── env.ts
│   └── constants.ts
├── middleware/
│   ├── errorHandler.ts
│   ├── cors.ts
│   └── logger.ts
├── routes/
│   ├── health.ts
│   └── index.ts
├── db/
│   ├── migrations/
│   └── seeds/
└── utils/
    ├── logger.ts
    └── database.ts
```

---

## YOUR OBJECTIVE

Build a **production-grade authentication system** with:

1. **User Registration** - Create new users (BARBER, CLIENT, ADMIN)
2. **Email Verification** - Verify ownership of email address
3. **User Login** - Authenticate with email/password, return JWT
4. **JWT Management** - Issue, validate, refresh tokens
5. **Password Hashing** - Secure storage with bcrypt
6. **Role-Based Access Control** - Middleware to check user roles
7. **Profile Management** - Get/update user profiles
8. **Token Refresh** - Refresh tokens for long-lived sessions
9. **Error Handling** - Type-safe, helpful error responses
10. **Type Safety** - Full TypeScript with zero `any` types

---

## TECHNOLOGY STACK (PHASE 1)

| Component            | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| **Password Hashing** | bcrypt (npm package)                                 |
| **JWT Library**      | jsonwebtoken (npm package)                           |
| **Email**            | Placeholder (nodemailer structure, no real send yet) |
| **Validation**       | Zod (already have)                                   |
| **Database**         | PostgreSQL (already have)                            |
| **Testing**          | Manual curl/Postman (no automated tests yet)         |

---

## ENDPOINTS TO BUILD

### 1. **User Registration**

```
POST /auth/register
Content-Type: application/json

Request Body:
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "userType": "CLIENT"  // or "BARBER"
}

Success Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "userType": "CLIENT",
  "emailVerified": false,
  "createdAt": "2024-01-15T10:30:00Z",
  "message": "Account created. Check email to verify."
}

Error Response (400):
{
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "Email already registered.",
  "statusCode": 400
}

Error Response (422):
{
  "error": "VALIDATION_ERROR",
  "message": "Password must be at least 8 characters.",
  "statusCode": 422
}
```

### 2. **Email Verification**

```
POST /auth/verify-email
Content-Type: application/json

Request Body:
{
  "email": "john@example.com",
  "verificationCode": "123456"  // 6-digit code sent to email
}

Success Response (200):
{
  "message": "Email verified successfully.",
  "emailVerified": true
}

Error Response (400):
{
  "error": "INVALID_CODE",
  "message": "Verification code is incorrect or expired.",
  "statusCode": 400
}
```

### 3. **Login**

```
POST /auth/login
Content-Type: application/json

Request Body:
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Success Response (200):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "userType": "CLIENT",
    "emailVerified": true
  },
  "expiresIn": 86400  // 24 hours in seconds
}

Error Response (401):
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect.",
  "statusCode": 401
}
```

### 4. **Refresh Token**

```
POST /auth/refresh
Content-Type: application/json

Request Body:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Success Response (200):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}

Error Response (401):
{
  "error": "INVALID_TOKEN",
  "message": "Refresh token expired or invalid.",
  "statusCode": 401
}
```

### 5. **Logout**

```
POST /auth/logout
Authorization: Bearer {accessToken}

Success Response (200):
{
  "message": "Logged out successfully."
}

Error Response (401):
{
  "error": "UNAUTHORIZED",
  "message": "No valid token provided.",
  "statusCode": 401
}
```

### 6. **Get Current User Profile**

```
GET /auth/me
Authorization: Bearer {accessToken}

Success Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "userType": "CLIENT",
  "phone": null,
  "emailVerified": true,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}

Error Response (401):
{
  "error": "UNAUTHORIZED",
  "message": "Token missing or invalid.",
  "statusCode": 401
}
```

### 7. **Update User Profile**

```
PATCH /auth/me
Authorization: Bearer {accessToken}
Content-Type: application/json

Request Body:
{
  "firstName": "Jonathan",
  "lastName": "Smith",
  "phone": "+1234567890"
}

Success Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "firstName": "Jonathan",
  "lastName": "Smith",
  "phone": "+1234567890",
  "userType": "CLIENT",
  "emailVerified": true,
  "updatedAt": "2024-01-15T11:45:00Z"
}

Error Response (400):
{
  "error": "INVALID_PHONE",
  "message": "Phone number format is invalid.",
  "statusCode": 400
}
```

### 8. **Request Password Reset**

```
POST /auth/forgot-password
Content-Type: application/json

Request Body:
{
  "email": "john@example.com"
}

Success Response (200):
{
  "message": "Password reset link sent to email.",
  "email": "john@example.com"
}

Note: Always return success (200) even if email doesn't exist (security: don't leak registered emails)
```

### 9. **Reset Password**

```
POST /auth/reset-password
Content-Type: application/json

Request Body:
{
  "email": "john@example.com",
  "resetCode": "abc123def456",
  "newPassword": "NewSecurePass123!"
}

Success Response (200):
{
  "message": "Password reset successfully. Please login.",
  "email": "john@example.com"
}

Error Response (400):
{
  "error": "INVALID_CODE",
  "message": "Reset code is invalid or expired.",
  "statusCode": 400
}
```

---

## DATABASE CHANGES NEEDED

### New Column: `password_hash` in `users` table

Add if not already present:

```sql
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
```

### Email Verification Tokens Table

Create a new table to store verification codes:

```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT code_not_empty CHECK (code != '')
);

CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
```

### Password Reset Tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_code ON password_reset_tokens(code);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

### Token Blacklist Table (for logout)

```sql
CREATE TABLE token_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_jti VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);
```

---

## FILE STRUCTURE TO CREATE

```
apps/api/src/
├── routes/
│   ├── auth.ts                    # All auth endpoints (NEW)
│   └── index.ts                   # Route aggregation (UPDATE)
│
├── middleware/
│   ├── auth.ts                    # JWT validation & role checks (NEW)
│   ├── errorHandler.ts            # Already exists
│   └── cors.ts                    # Already exists
│
├── services/
│   └── auth/                      # (NEW folder)
│       ├── userService.ts         # User creation, queries
│       ├── authService.ts         # Login, registration logic
│       ├── tokenService.ts        # JWT creation, validation, refresh
│       ├── emailService.ts        # Email placeholder (no real send)
│       └── passwordService.ts     # Password hashing, validation
│
├── types/
│   └── auth.ts                    # Auth-specific types (NEW)
│
└── db/
    ├── migrations/
    │   └── 002_auth_tables.ts     # New tables migration (NEW)
    └── queries/
        └── auth.queries.ts        # Reusable DB queries (NEW)
```

---

## TYPESCRIPT TYPES (In `packages/shared-types`)

Update or add these types:

```typescript
// packages/shared-types/src/auth.ts (NEW FILE)

import { z } from 'zod';
import { UserTypeEnum } from './enums';

// ==================== REQUEST SCHEMAS ====================

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  userType: UserTypeEnum,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  email: z.string().email(),
  verificationCode: z.string().length(6),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const UpdateProfileRequestSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
  resetCode: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

// ==================== RESPONSE SCHEMAS ====================

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    userType: UserTypeEnum,
    emailVerified: z.boolean(),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  userType: UserTypeEnum,
  emailVerified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

// ==================== JWT PAYLOAD ====================

export const JWTPayloadSchema = z.object({
  jti: z.string().uuid(), // JWT ID (for blacklist)
  userId: z.string().uuid(),
  email: z.string().email(),
  userType: UserTypeEnum,
  iat: z.number(),
  exp: z.number(),
});
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
```

---

## ENVIRONMENT VARIABLES (Add to `.env`)

```env
# JWT
JWT_SECRET=your_jwt_secret_here_change_in_production_min_32_chars
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=your_refresh_secret_here_change_in_production
JWT_REFRESH_EXPIRY=7d

# Email (Placeholder)
EMAIL_FROM=noreply@barbersaas.com
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=

# Verification
EMAIL_VERIFICATION_CODE_LENGTH=6
EMAIL_VERIFICATION_EXPIRES_IN=24h
PASSWORD_RESET_CODE_LENGTH=32
PASSWORD_RESET_EXPIRES_IN=1h

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## IMPLEMENTATION REQUIREMENTS

### Security Requirements

- ✅ **Password hashing**: Use bcrypt with salt rounds ≥ 10
- ✅ **JWT signing**: Use HS256 algorithm with strong secret
- ✅ **Token expiry**: Access tokens 24h, refresh tokens 7d
- ✅ **Rate limiting**: Limit login/register attempts (placeholder for now)
- ✅ **HTTPS ready**: Accept X-Forwarded-* headers from proxy
- ✅ **CORS**: Restrict to configured origins
- ✅ **Validation**: Validate all inputs with Zod before processing

### Error Handling

- ✅ **Type-safe errors**: Create `AuthError` class extending `Error`
- ✅ **Helpful messages**: Don't leak sensitive info (e.g., "invalid email or password")
- ✅ **Consistent format**: All errors follow same structure
- ✅ **Logging**: Log all auth attempts (success & failure)

### Code Organization

- ✅ **Services**: Business logic (user creation, token generation)
- ✅ **Routes**: Express route handlers (HTTP layer)
- ✅ **Middleware**: Auth validation & role checking
- ✅ **Types**: Zod schemas + TS types in shared package
- ✅ **Queries**: Database queries in separate file for reusability

### Testing Approach

Create a `PHASE_1_AUTH_TESTS.md` file with curl examples for each endpoint:

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "firstName": "Test",
    "lastName": "User",
    "userType": "CLIENT"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }'

# Get Profile (with token)
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer {accessToken}"
```

---

## MIDDLEWARE TO BUILD

### 1. **Auth Middleware** (`apps/api/src/middleware/auth.ts`)

```typescript
// Validates JWT token from Authorization header
// Attaches decoded payload to req.user
// Returns 401 if invalid/missing
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'No token provided',
    });
  }

  // Verify token, decode payload
  // Check if token in blacklist
  // Attach user to req
  // Call next()
};
```

### 2. **Role Middleware**

```typescript
// Checks if user has required role
export const requireRole = (...roles: UserType[]) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.userType)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    next();
  };
};
```

### 3. **Error Middleware** (Update existing)

Ensure it catches and properly formats auth errors.

---

## SERVICE LAYER FUNCTIONS

### `AuthService`

- `registerUser(email, password, firstName, lastName, userType)`
- `loginUser(email, password)`
- `verifyEmail(email, code)`
- `forgotPassword(email)`
- `resetPassword(email, code, newPassword)`
- `logoutUser(jti)`

### `TokenService`

- `generateAccessToken(user)`
- `generateRefreshToken(user)`
- `verifyToken(token, secret)`
- `refreshAccessToken(refreshToken)`
- `blacklistToken(jti, expiresAt)`
- `isTokenBlacklisted(jti)`

### `PasswordService`

- `hashPassword(password)`
- `comparePassword(password, hash)`
- `validatePassword(password)` - checks strength

### `UserService`

- `getUserById(id)`
- `getUserByEmail(email)`
- `createUser(userData)`
- `updateUser(id, updates)`
- `getUserWithBarberProfile(id)` - for barbers

### `EmailService` (Placeholder)

- `sendVerificationEmail(email, code)` - log to console, don't send
- `sendPasswordResetEmail(email, code)` - log to console, don't send
- Structure ready for real implementation later

---

## DELIVERABLES CHECKLIST

### Routes & Endpoints

- [ ] `POST /auth/register` - Create new user
- [ ] `POST /auth/verify-email` - Confirm email ownership
- [ ] `POST /auth/login` - Authenticate and get tokens
- [ ] `POST /auth/refresh` - Get new access token
- [ ] `POST /auth/logout` - Invalidate token
- [ ] `GET /auth/me` - Get current user profile
- [ ] `PATCH /auth/me` - Update profile
- [ ] `POST /auth/forgot-password` - Request reset
- [ ] `POST /auth/reset-password` - Reset password

### Database

- [ ] Migration file `002_auth_tables.ts` with 3 new tables
- [ ] Indexes on all lookup columns
- [ ] Foreign key relationships

### Services

- [ ] `services/auth/authService.ts`
- [ ] `services/auth/tokenService.ts`
- [ ] `services/auth/passwordService.ts`
- [ ] `services/auth/userService.ts`
- [ ] `services/auth/emailService.ts`

### Middleware

- [ ] `middleware/auth.ts` - JWT validation
- [ ] `middleware/auth.ts` - Role checking
- [ ] Updated `middleware/errorHandler.ts` for auth errors

### Types

- [ ] `packages/shared-types/src/auth.ts` - All schemas
- [ ] Export from `packages/shared-types/src/index.ts`

### Documentation

- [ ] `docs/AUTH.md` - Auth system architecture
- [ ] `PHASE_1_AUTH_TESTS.md` - curl examples for testing

### Configuration

- [ ] Update `.env.example` with JWT secrets
- [ ] Update `apps/api/src/config/env.ts` to validate auth vars

---

## SUCCESS CRITERIA

You'll know Phase 1 is complete when:

```bash
# 1. Type checking passes
pnpm typecheck

# 2. Linting passes
pnpm lint

# 3. Can register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!",
    "firstName": "New",
    "lastName": "User",
    "userType": "CLIENT"
  }'
# Returns 201 with user object

# 4. Can login with seed data user
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client1@example.com",
    "password": "password123"
  }'
# Returns 200 with accessToken, refreshToken, user

# 5. Can access protected route with token
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer {accessToken}"
# Returns 200 with user profile

# 6. Token expires and refresh works
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "{refreshToken}"}'
# Returns 200 with new accessToken

# 7. Can logout (token blacklisted)
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer {accessToken}"
# Returns 200 with success message

# 8. Logout token rejected
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer {blacklistedToken}"
# Returns 401 with "Token blacklisted" error

# 9. Invalid credentials rejected
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client1@example.com",
    "password": "wrongpassword"
  }'
# Returns 401 with "Invalid credentials" error

# 10. Role-based access works (test with admin middleware)
curl -X GET http://localhost:3000/admin/users \
  -H "Authorization: Bearer {clientToken}"
# Returns 403 with "Insufficient permissions" error
```

---

## SEED DATA UPDATES

Update `apps/api/src/db/seeds/seed.ts` to:

1. **Hash all user passwords** instead of storing plain text
2. **Create email verification tokens** for seed users (mark some as verified)
3. **Create test refresh tokens** (optional, for manual testing)
4. **Document test user credentials**:
   ```
   Test Users (after seed):
   - Email: barber1@example.com, Password: password123, Type: BARBER
   - Email: barber2@example.com, Password: password123, Type: BARBER
   - Email: barber3@example.com, Password: password123, Type: BARBER
   - Email: client1@example.com, Password: password123, Type: CLIENT
   - Email: client2@example.com, Password: password123, Type: CLIENT
   ... (all clients)
   - Email: admin@example.com, Password: password123, Type: ADMIN
   ```

---

## WHAT NOT TO INCLUDE (INTENTIONALLY SKIPPED)

❌ Two-factor authentication (2FA) - future phase  
❌ OAuth/Social login (Google, GitHub) - future phase  
❌ Real email sending - placeholder only  
❌ Rate limiting enforcement - structure ready, not implemented  
❌ Automated tests/Jest setup - manual testing only  
❌ Frontend authentication pages - future phase  
❌ Account deletion flow - can add later  
❌ Password change endpoint - just reset for now

---

## IMPORTANT NOTES

### Password Hashing

- Use `bcrypt` library with salt rounds = 10
- Hash during registration and password reset
- Never store plain text passwords
- Always compare with hashed version on login

### JWT Tokens

- Use `jsonwebtoken` library
- Include `jti` (JWT ID) in payload for blacklisting
- Access tokens: short-lived (24 hours)
- Refresh tokens: long-lived (7 days)
- Rotate refresh tokens on use (optional but recommended)

### Email Verification

- Generate 6-digit code, store with expiry (24 hours)
- For now, log to console instead of sending email
- Mark `users.email_verified = true` after verification
- Don't allow login until verified (or allow but flag it)

### Error Messages

Be helpful but not leaky:

- ✅ "Email or password is incorrect" (don't say which)
- ✅ "Verification code invalid or expired"
- ✅ "Token has expired, please refresh"
- ❌ Don't say "user not found"
- ❌ Don't say "password doesn't match"

---

## NEXT PHASE AFTER PHASE 1

Once authentication is solid:

**Phase 2: Barber Profile & Service Management**

- Complete barber profile endpoints
- Service CRUD operations
- Availability scheduling
- Barber search/discovery foundations

---

## QUICK REFERENCE: REQUEST EXAMPLES

### Register

```bash
POST /auth/register
{
  "email": "john@barbershop.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Smith",
  "userType": "BARBER"
}
```

### Login

```bash
POST /auth/login
{
  "email": "john@barbershop.com",
  "password": "SecurePass123!"
}
```

### Get Profile

```bash
GET /auth/me
Authorization: Bearer {accessToken}
```

### Update Profile

```bash
PATCH /auth/me
Authorization: Bearer {accessToken}
{
  "firstName": "Jonathan",
  "phone": "+1234567890"
}
```

### Verify Email

```bash
POST /auth/verify-email
{
  "email": "john@barbershop.com",
  "verificationCode": "123456"
}
```

---

## STRUCTURE YOUR RESPONSE

When you complete this, provide:

1. **Summary** (5 lines): What was built
2. **Files Created** (with paths): List all new/modified files
3. **Database Migrations**: Show migration file
4. **Key Services**: Show main service implementations
5. **Route Handlers**: Show auth route implementations
6. **Testing Steps**: 10 curl commands to verify
7. **Notes**: Any decisions, gotchas, follow-ups

---

## FINAL CHECKLIST

Before submitting to Claude:

- [ ] Understand all 9 endpoints
- [ ] Know the 3 new database tables
- [ ] Understand JWT flow (issue, validate, refresh, blacklist)
- [ ] Understand role-based access control approach
- [ ] Ready to use bcrypt for password hashing
- [ ] Ready for placeholder email service
- [ ] Clear on what's not included (2FA, OAuth, etc.)
- [ ] Ready to receive TypeScript code with zero `any` types

---

**Phase 1 unblocks everything. Build it right. You're doing great! 🚀**
