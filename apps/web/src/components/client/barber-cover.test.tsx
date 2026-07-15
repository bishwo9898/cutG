import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarberCover } from './barber-cover';

describe('BarberCover', () => {
  it('keeps a stable cover container and falls back when an image fails', () => {
    render(<BarberCover alt="Main Street Cuts" src="https://bad.example/cover.jpg" />);
    fireEvent.error(screen.getByRole('img', { name: 'Main Street Cuts' }));

    expect(screen.getByRole('img', { name: /image unavailable/i })).toBeTruthy();
    expect(screen.getByText('cutG')).toBeTruthy();
  });
});
