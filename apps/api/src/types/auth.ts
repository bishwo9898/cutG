import type { UserType } from '@barber-saas/shared-types';
import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  userType: UserType;
  emailVerified: boolean;
};

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedUser;
};

export type ClerkPublicMetadata = {
  userType?: UserType;
  internalUserId?: string;
};
