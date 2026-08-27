import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardShell } from './dashboard-shell';

vi.mock('@clerk/nextjs', (): object => ({
  useClerk: (): { signOut: () => Promise<void> } => ({ signOut: vi.fn(async () => {}) }),
}));

vi.mock('next/navigation', (): object => ({
  usePathname: (): string => '/barber/dashboard/appointments',
  useRouter: (): { refresh: () => void; replace: () => void } => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-user', (): object => ({
  useUser: (): { data: { email: string; firstName: string; lastName: string } } => ({
    data: { email: 'barber@example.com', firstName: 'Mobile', lastName: 'Barber' },
  }),
}));

vi.mock('@/components/barber-location-access', (): object => ({
  BarberLocationAccess: (): React.ReactElement => <div>Location access</div>,
}));

describe('DashboardShell mobile navigation', () => {
  afterEach(cleanup);

  it('keeps appointments in the five primary phone tabs', () => {
    render(
      <DashboardShell>
        <div>Dashboard content</div>
      </DashboardShell>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Mobile dashboard' });
    const links = within(navigation).getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(
      within(navigation).getByRole('link', { name: /appointments/i }).getAttribute('href'),
    ).toBe('/barber/dashboard/appointments');
  });
});
