import type { AuthUserSummary } from '@barber-saas/shared-types';
import { createClerkClient } from '@clerk/backend';

import { env } from '../../config/env';
import {
  createUserForClerkId,
  findUserByClerkId,
  type UserRecord,
} from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';

import { toAuthUserSummary } from './userService';

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

const setClerkPublicMetadata = async (
  clerkUserId: string,
  userType: UserRecord['user_type'],
  internalUserId: string,
): Promise<void> => {
  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { userType, internalUserId },
  });
};

export const syncUser = async (
  clerkUserId: string,
  userType: 'BARBER' | 'CLIENT',
): Promise<AuthUserSummary> => {
  const existing = await findUserByClerkId(clerkUserId);

  if (existing !== null) {
    return toAuthUserSummary(existing);
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId,
  );

  if (primaryEmail === undefined) {
    throw new AppError(400, 'The Clerk account has no primary email address.', 'INVALID_INPUT');
  }

  const created = await createUserForClerkId({
    clerkUserId,
    email: primaryEmail.emailAddress,
    firstName: clerkUser.firstName?.trim() || 'New',
    lastName: clerkUser.lastName?.trim() || 'User',
    userType,
    emailVerified: primaryEmail.verification?.status === 'verified',
  });

  await setClerkPublicMetadata(clerkUserId, created.user_type, created.id);

  return toAuthUserSummary(created);
};
