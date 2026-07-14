import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StaticMap } from './static-map';

describe('StaticMap', () => {
  it('renders a useful address fallback when coordinates are unavailable', () => {
    render(
      <StaticMap
        address="600 West Walnut Street, Danville, KY 40422"
        latitude={null}
        longitude={null}
      />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('600 West Walnut Street, Danville, KY 40422')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open in google maps/i })).toBeTruthy();
  });
});
