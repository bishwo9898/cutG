import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HairPhotoUpload } from './hair-photo-upload';

describe('HairPhotoUpload', () => {
  it('offers camera and library capture while rejecting unsupported files locally', async () => {
    render(<HairPhotoUpload onComplete={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Take a photo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Upload a photo/ })).toBeTruthy();
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(inputs[1]?.getAttribute('capture')).toBe('user');

    fireEvent.change(inputs[0] as HTMLInputElement, {
      target: { files: [new File(['not-an-image'], 'portrait.gif', { type: 'image/gif' })] },
    });
    expect(await screen.findByText('Choose a JPEG, PNG, or WebP headshot.')).toBeTruthy();
  });
});
