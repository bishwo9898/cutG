import type { TokenCache } from '@clerk/clerk-expo';

import * as SecureStore from '@/lib/secureStorage';

export const tokenCache: TokenCache = {
  getToken: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
  clearToken: (key: string): void => {
    void SecureStore.deleteItemAsync(key);
  },
};
