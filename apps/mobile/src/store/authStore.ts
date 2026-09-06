import { create } from 'zustand';

import type { AuthUser } from '@/lib/types';
import { stopBackgroundLocationTracking } from '@/services/locationTrackingStorage';

export type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  /**
   * False when the account could not be loaded because the API was out of reach — as opposed to
   * because nobody is signed in. Without the distinction the app cannot tell "you have no account"
   * from "your train went into a tunnel", and it used to answer both with the welcome screen.
   */
  reachable: boolean;
  setUser: (user: AuthUser | null) => void;
  setUnreachable: () => void;
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
    set({ user: null, isLoading: false, reachable: true });
  },
  isLoading: true,
  reachable: true,
  setUser: (user: AuthUser | null): void => set({ user, isLoading: false, reachable: true }),
  setUnreachable: (): void => set({ isLoading: false, reachable: false }),
  updateUser: (user: AuthUser): void => set({ user: { ...get().user, ...user } }),
  user: null,
}));
