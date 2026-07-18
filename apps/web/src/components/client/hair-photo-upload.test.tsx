import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HairPhotoUpload } from './hair-photo-upload';

describe('HairPhotoUpload', () => {
  it('uses one image file picker and rejects unsupported files locally', async () => {
    render(<HairPhotoUpload onComplete={vi.fn()} />);

    expect(screen.getByText('Upload one clear headshot')).toBeTruthy();
    const input = document.querySelector('input[type="file"]');
    expect(input?.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['not-an-image'], 'portrait.gif', { type: 'image/gif' })] },
    });
    expect(await screen.findByText('Choose a JPEG, PNG, or WebP headshot.')).toBeTruthy();
  });
});
