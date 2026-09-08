import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthShell } from './auth-shell';

describe('AuthShell', () => {
  // vitest is not running with `globals`, so Testing Library's automatic cleanup never registers.
  afterEach(cleanup);

  it('loads no imagery at all', () => {
    // The shell used to put a full-bleed photograph behind half the screen. Sign-in is the one
    // page where somebody is trying to do a single thing, and it should not wait on a picture.
    const { container } = render(
      <AuthShell audience="CLIENT">
        <form className="auth-form" />
      </AuthShell>,
    );

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('background-image');
    expect(container.innerHTML).not.toContain('url(');
  });

  it('puts the form in a single centred column', () => {
    const { container } = render(
      <AuthShell>
        <form className="auth-form" data-testid="form" />
      </AuthShell>,
    );

    const inner = container.querySelector('.auth-shell-inner');
    expect(inner).not.toBeNull();
    // The form is a direct child of the centred column rather than a pane beside a brand panel.
    expect(screen.getByTestId('form').parentElement).toBe(inner);
  });

  it('says something audience-specific without a half-screen quote to hold it', () => {
    const barber = render(<AuthShell audience="BARBER">{null}</AuthShell>);
    expect(barber.container.querySelector('.auth-shell-note')?.textContent).toMatch(/workspace/i);
    barber.unmount();

    const client = render(<AuthShell audience="CLIENT">{null}</AuthShell>);
    expect(client.container.querySelector('.auth-shell-note')?.textContent).toMatch(/barbers/i);
  });
});
