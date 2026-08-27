import { create } from 'zustand';

import type { AuthUser } from '@/lib/types';
import { stopBackgroundLocationTracking } from '@/services/locationTrackingStorage';

export type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  updateUser: (user: AuthUser) => void;
  clearAuth: () => Promise<void>;
};

/**
 * Mirrors Clerk's signed-in user for screens that need it outside React context (e.g. background
 * location tasks) or via the `/auth/me` response shape (internal user id, phone, etc. that Clerk
 * itself doesn't know about). `AuthBridge` in the root layout is the only writer of `setUser`;
 * Clerk's own `useAuth()`/`useUser()` hooks remain the source of truth for session state itself.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  clearAuth: async (): Promise<void> => {
    await stopBackgroundLocationTracking();
    set({ user: null, isLoading: false });
  },
  isLoading: true,
  setUser: (user: AuthUser | null): void => set({ user, isLoading: false }),
  updateUser: (user: AuthUser): void => set({ user: { ...get().user, ...user } }),
  user: null,
}));
