import type { AuthUserSummary } from '@barber-saas/shared-types';
import { createClerkClient } from '@clerk/backend';

import { env } from '../../config/env';
import {
  createUserForClerkId,
  findUnlinkedUserByEmail,
  findUserByClerkId,
  linkClerkUserId,
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

  const emailVerified = primaryEmail.verification?.status === 'verified';

  // `users.email` is UNIQUE, so a Clerk account whose email already has a local row cannot simply
  // be inserted — it has to adopt that row. This is the normal path for accounts that existed
  // before the Clerk migration (which added clerk_user_id as nullable and backfilled nothing) and
  // for seeded accounts, whose rows are created by the seed rather than by a sign-up.
  //
  // Only ever adopt a row that is still unlinked AND whose email Clerk has verified: without the
  // verification check, signing up with an unverified address that happens to match an existing
  // user would hand over that user's account.
  const unlinked = await findUnlinkedUserByEmail(primaryEmail.emailAddress);

  if (unlinked !== null) {
    if (!emailVerified) {
      throw new AppError(
        403,
        'Verify this email address before it can be linked to the existing account.',
        'EMAIL_NOT_VERIFIED',
      );
    }

    const linked = await linkClerkUserId(unlinked.id, clerkUserId);

    if (linked === null) {
      // Lost a race with a concurrent sync; that one linked the row, so re-read it.
      const now = await findUserByClerkId(clerkUserId);

      if (now === null) {
        throw new AppError(409, 'That email is already linked to another account.', 'CONFLICT');
      }

      return toAuthUserSummary(now);
    }

    await setClerkPublicMetadata(clerkUserId, linked.user_type, linked.id);

    return toAuthUserSummary(linked);
  }

  const created = await createUserForClerkId({
    clerkUserId,
    email: primaryEmail.emailAddress,
    firstName: clerkUser.firstName?.trim() || 'New',
    lastName: clerkUser.lastName?.trim() || 'User',
    userType,
    emailVerified,
  });

  await setClerkPublicMetadata(clerkUserId, created.user_type, created.id);

  return toAuthUserSummary(created);
};
