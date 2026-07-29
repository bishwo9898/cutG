import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BeforeAfterSlider } from './before-after-slider';

describe('BeforeAfterSlider', () => {
  it('renders an accessible comparison control and updates its position', () => {
    render(
      <BeforeAfterSlider
        afterUrl="https://example.com/after.jpg"
        beforeUrl="https://example.com/before.jpg"
        title="Textured taper"
      />,
    );

    expect(screen.getByRole('img', { name: 'Textured taper, before haircut' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Textured taper, after haircut' })).toBeTruthy();

    const slider = screen.getByRole('slider', {
      name: 'Compare the before and after photos for Textured taper',
    });
    fireEvent.change(slider, { target: { value: '72' } });

    expect((slider as HTMLInputElement).value).toBe('72');
    expect(slider.getAttribute('aria-valuetext')).toBe('72% after photo shown');
  });
});
