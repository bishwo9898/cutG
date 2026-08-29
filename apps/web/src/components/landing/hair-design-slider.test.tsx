import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HairDesignSlider } from './hair-design-slider';

describe('HairDesignSlider', () => {
  it('uses the supplied images and follows the pointer without a click', () => {
    const { container } = render(<HairDesignSlider />);

    const beforeSrc = screen.getByRole('img', { name: 'Before haircut' }).getAttribute('src') ?? '';
    const afterSrc = screen.getByRole('img', { name: 'After haircut' }).getAttribute('src') ?? '';
    expect(decodeURIComponent(beforeSrc)).toContain('/images/landing/hair-preview-before.webp');
    expect(decodeURIComponent(afterSrc)).toContain('/images/landing/hair-preview-after.png');
    expect(screen.queryByText('Before')).toBeNull();
    expect(screen.queryByText('AI Preview')).toBeNull();

    const frame = container.querySelector('.landing-cinematic-slider-frame') as HTMLDivElement;
    Object.defineProperty(frame, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 800 }),
    });
    const pointerEvent = (type: string, clientX: number): Event => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        clientX: { value: clientX },
        pointerId: { value: 1 },
      });
      return event;
    };

    fireEvent(frame, pointerEvent('pointermove', 700));

    expect(
      screen.getByRole('slider', { name: 'Adjust before and after preview' }).getAttribute('aria-valuenow'),
    ).toBe('75');
    expect(
      (container.querySelector('.landing-cinematic-slider-divider') as HTMLDivElement).style.left,
    ).toBe('75%');
  });
});
