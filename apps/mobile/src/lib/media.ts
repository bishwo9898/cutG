/**
 * React Native's `Image` needs an absolute URI. The API stores some media as root-relative paths
 * (for example `/images/barbers/barber-1.webp`), which resolve against the web app's own origin and
 * mean nothing on a phone — `<Image source={{ uri: '/images/…' }} />` silently renders a blank box.
 *
 * That is worse than showing nothing, because the caller's `url !== null` check still passes, so
 * the placeholder never appears and the screen is left with a hole in it. This returns a URI only
 * when it is one the device can actually fetch, so callers can fall back honestly.
 */
export const remoteImageUri = (url: string | null | undefined): string | null => {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  // data: and file: are already device-loadable (camera picks, generated previews).
  return /^(https?|data|file):/i.test(trimmed) ? trimmed : null;
};
