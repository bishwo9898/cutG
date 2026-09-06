import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Writes the query cache to a file so the app opens on what it knew last time.
 *
 * `expo-file-system` rather than AsyncStorage or MMKV on purpose: it is already linked into the
 * native binary, so this costs no rebuild — and the first Gradle build on this project took
 * 55 minutes.
 *
 * The file lives in the document directory, which is private to the app and excluded from device
 * backups on neither platform by default — acceptable because the cache is cleared on sign-out and
 * keyed to the account that wrote it (see `cachePolicy.ts`), so what survives is only ever the
 * current user's own data.
 *
 * Every operation swallows its errors. A cache is an optimisation; a phone that is out of disk, or
 * a half-written file from a process the OS killed mid-write, must degrade to "fetch it again",
 * never to a crash on launch.
 */
const CACHE_DIRECTORY = 'query-cache';
const CACHE_FILE = 'client.json';

const cacheFile = (): File => {
  const directory = new Directory(Paths.document, CACHE_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });
  return new File(directory, CACHE_FILE);
};

/**
 * Writes are debounced because React Query persists on every cache change, and a busy screen —
 * a list paging in, a poll landing — would otherwise serialise the whole cache several times a
 * second. Losing the last second of cache on a hard kill costs nothing; it is refetched.
 */
const WRITE_DEBOUNCE_MS = 1_000;

export const createFilePersister = (): Persister => {
  let pending: PersistedClient | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    timer = null;
    const client = pending;
    pending = null;
    if (client === null) return;
    try {
      const file = cacheFile();
      if (!file.exists) file.create();
      file.write(JSON.stringify(client));
    } catch {
      // Out of disk, or the directory vanished. The next launch simply starts cold.
    }
  };

  return {
    persistClient: (client: PersistedClient): void => {
      pending = client;
      if (timer === null) timer = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const file = cacheFile();
        if (!file.exists) return undefined;
        const contents = await file.text();
        return JSON.parse(contents) as PersistedClient;
      } catch {
        // A truncated or malformed file is indistinguishable from no file, and is treated the
        // same way. Remove it so the next launch does not pay to parse it again.
        try {
          cacheFile().delete();
        } catch {
          /* nothing more to do */
        }
        return undefined;
      }
    },

    removeClient: (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      // A queued write must not resurrect the cache moments after sign-out cleared it.
      pending = null;
      try {
        const file = cacheFile();
        if (file.exists) file.delete();
      } catch {
        /* already gone */
      }
    },
  };
};
