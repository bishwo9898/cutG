import type { AuthUser, AuthUserSummary } from '@barber-saas/shared-types';

import {
  findPublicUserById,
  updateUserProfile,
  type UpdateUserProfileInput,
  type UserRecord,
} from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';

export const toAuthUserSummary = (user: UserRecord): AuthUserSummary => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    userType: user.user_type,
    emailVerified: user.email_verified,
  };
};

export const toAuthUser = (user: UserRecord): AuthUser => {
  return {
    ...toAuthUserSummary(user),
    phone: user.phone,
    isActive: user.is_active,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  };
};

export const getCurrentUser = async (userId: string): Promise<AuthUser> => {
  const user = await findPublicUserById(userId);

  if (user === null || !user.is_active) {
    throw new AppError(404, 'User not found.', 'USER_NOT_FOUND');
  }

  return toAuthUser(user);
};

export const updateCurrentUser = async (
  userId: string,
  input: UpdateUserProfileInput,
): Promise<AuthUser> => {
  const user = await updateUserProfile(userId, input);

  if (user === null || !user.is_active) {
    throw new AppError(404, 'User not found.', 'USER_NOT_FOUND');
  }

  return toAuthUser(user);
};
