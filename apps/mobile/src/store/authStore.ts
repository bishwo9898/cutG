import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { AuthUser } from '@/lib/types';
import { stopBackgroundLocationTracking } from '@/services/locationTrackingStorage';

const ACCESS_TOKEN_KEY = 'cutg.accessToken';
const REFRESH_TOKEN_KEY = 'cutg.refreshToken';
const USER_KEY = 'cutg.user';

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAccessToken: (accessToken: string) => Promise<void>;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
};

const parseStoredUser = (value: string | null): AuthUser | null => {
  if (value === null) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  clearAuth: async (): Promise<void> => {
    await stopBackgroundLocationTracking();
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, user: null, isLoading: false });
  },
  isLoading: true,
  loadStoredAuth: async (): Promise<void> => {
    const [accessToken, refreshToken, storedUser] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    set({ accessToken, refreshToken, user: parseStoredUser(storedUser), isLoading: false });
  },
  refreshToken: null,
  setAccessToken: async (accessToken: string): Promise<void> => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    set({ accessToken });
  },
  setAuth: async (user: AuthUser, accessToken: string, refreshToken: string): Promise<void> => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ accessToken, refreshToken, user, isLoading: false });
  },
  updateUser: async (user: AuthUser): Promise<void> => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user: { ...get().user, ...user } });
  },
  user: null,
}));
