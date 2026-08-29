import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingSection } from './landing-section';

describe('LandingSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reveals its content once it enters the viewport', () => {
    let onIntersect: IntersectionObserverCallback | undefined;
    const unobserve = vi.fn();

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersect = callback;
        }

        disconnect = vi.fn();
        observe = vi.fn();
        unobserve = unobserve;
        root = null;
        rootMargin = '0px';
        thresholds = [];
        takeRecords = vi.fn(() => []);
      },
    );
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });

    const { container } = render(
      <LandingSection className="test-section">
        <p>Revealed section</p>
      </LandingSection>,
    );
    const section = container.querySelector('section') as HTMLElement;

    expect(section.className).toContain('landing-scroll-reveal');
    expect(section.className).not.toContain('is-visible');

    act(() => {
      onIntersect?.(
        [{ isIntersecting: true, target: section } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(section.className).toContain('is-visible');
    expect(unobserve).toHaveBeenCalledWith(section);
  });
});
