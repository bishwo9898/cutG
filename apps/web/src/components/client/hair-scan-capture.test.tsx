import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HairScanCapture } from './hair-scan-capture';

describe('HairScanCapture', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    });
  });

  it('provides camera-enabled-device guidance when permission is denied', async () => {
    render(<HairScanCapture onComplete={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Camera access is needed' })).toBeTruthy(),
    );
    expect(screen.getByText(/rejected frames are never uploaded/i)).toBeTruthy();
  });
});
