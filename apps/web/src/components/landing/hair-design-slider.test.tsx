import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HairDesignSlider } from './hair-design-slider';

describe('HairDesignSlider', () => {
  // vitest is not running with `globals`, so Testing Library's automatic cleanup never registers
  // and renders would otherwise stack across tests in the same file.
  afterEach(cleanup);

  it('sends visitors to book rather than into the unfinished studio', () => {
    // The wipe is back on the public page while the AI studio behind it is still being built.
    // A "try it" link here would drop a first-time visitor into a half-finished feature.
    render(<HairDesignSlider />);
    const cta = screen.getByRole('link');
    expect(cta.getAttribute('href')).toBe('/client/start');
    expect(cta.getAttribute('href')).not.toContain('design');
  });

  it('drops its footer when the section around it already carries the copy', () => {
    const { container } = render(<HairDesignSlider showFooter={false} />);
    expect(container.querySelector('.landing-cinematic-slider-footer')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

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
