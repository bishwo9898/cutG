import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Notice } from './notice';

describe('Notice', () => {
  it('uses an alert role for API errors', () => {
    render(<Notice>Service limit reached.</Notice>);

    expect(screen.getByRole('alert').textContent).toContain('Service limit reached.');
  });

  it('uses a status role for successful mutations', () => {
    render(<Notice tone="success">Profile changes saved.</Notice>);

    expect(screen.getByRole('status').textContent).toContain('Profile changes saved.');
  });
});
