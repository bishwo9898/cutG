import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StaticMap } from './static-map';

describe('StaticMap', () => {
  it('renders a useful map fallback when no browser key is configured', () => {
    render(
      <StaticMap
        address="600 West Walnut Street, Danville, KY 40422"
        latitude={37.6454}
        longitude={-84.7739}
      />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('600 West Walnut Street, Danville, KY 40422')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open in google maps/i })).toBeTruthy();
  });
});
