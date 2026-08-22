import * as SecureStore from 'expo-secure-store';

const browserStorage = (): Storage | null =>
  typeof document === 'undefined' ? null : window.localStorage;

export const getItemAsync = async (key: string): Promise<string | null> => {
  const storage = browserStorage();
  if (storage !== null) return storage.getItem(key);
  return SecureStore.getItemAsync(key);
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  const storage = browserStorage();
  if (storage !== null) {
    storage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  const storage = browserStorage();
  if (storage !== null) {
    storage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};
