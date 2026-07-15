import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./client-map', () => ({
  ClientMap: (): React.ReactElement => <div data-testid="client-map" />,
}));

import { StaticMap } from './static-map';

describe('StaticMap', () => {
  it('renders the MapLibre client map when exact coordinates exist', () => {
    render(
      <StaticMap
        address="600 West Walnut Street, Danville, KY 40422"
        latitude={37.6454}
        longitude={-84.7739}
      />,
    );

    expect(screen.getByTestId('client-map')).toBeTruthy();
    expect(screen.getByLabelText(/map showing 600 west walnut/i)).toBeTruthy();
  });

  it('renders a useful fallback when coordinates are unavailable', () => {
    render(
      <StaticMap
        address="600 West Walnut Street, Danville, KY 40422"
        latitude={null}
        longitude={null}
      />,
    );

    expect(screen.getByText('600 West Walnut Street, Danville, KY 40422')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open directions/i })).toBeTruthy();
  });
});
