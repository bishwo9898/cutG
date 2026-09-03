import { describe, expect, it } from 'vitest';

import { remoteImageUri } from './media';

describe('remoteImageUri', () => {
  it('passes through URIs the device can actually load', () => {
    expect(remoteImageUri('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(remoteImageUri('http://10.0.2.2:4000/a.jpg')).toBe('http://10.0.2.2:4000/a.jpg');
    expect(remoteImageUri('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(remoteImageUri('file:///tmp/pick.jpg')).toBe('file:///tmp/pick.jpg');
  });

  it('rejects root-relative web paths, which render as a blank box on a device', () => {
    // This is the real shape the API returns for seeded barbers.
    expect(remoteImageUri('/images/barbers/barber-1.webp')).toBeNull();
    expect(remoteImageUri('images/barbers/barber-1.webp')).toBeNull();
  });

  it('treats missing and empty values as no image', () => {
    expect(remoteImageUri(null)).toBeNull();
    expect(remoteImageUri(undefined)).toBeNull();
    expect(remoteImageUri('   ')).toBeNull();
  });
});
