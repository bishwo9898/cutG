/// <reference types="node" />
// This spec runs in Node under vitest, not on a device, so it can read the web stylesheet
// directly. The reference above pulls in the Node types it needs without adding them to the
// React Native app's own tsconfig.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { colors, textBackgrounds, textSafeColors } from './colors';

/**
 * The mobile palette is a hand-maintained mirror of the web design tokens. Nothing at runtime ties
 * them together, so this test is the tie: it reads the real stylesheet and fails when a colour is
 * changed on one side only. That is not hypothetical — mobile's secondary text sat a full step
 * lighter than the web's for a while, and nothing noticed.
 */
const tokenCss = readFileSync(
  join(__dirname, '../../../../apps/web/src/app/styles/ivory-tokens.css'),
  'utf8',
);

const webToken = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(tokenCss);
  if (match?.[1] === undefined) {
    throw new Error(`--${name} is not defined in ivory-tokens.css`);
  }
  return match[1].toLowerCase();
};

const toRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
};

const luminance = (hex: string): number => {
  const channel = (raw: number): number => {
    const v = raw / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('mobile palette', () => {
  it.each([
    ['primary', 'ivory-ink'],
    ['background', 'ivory-canvas'],
    ['surface', 'ivory-surface'],
    ['surfaceRaised', 'ivory-surface-raised'],
    ['border', 'ivory-line'],
    ['borderLight', 'ivory-line-strong'],
    ['textPrimary', 'ivory-ink'],
    ['textSecondary', 'ivory-muted'],
    ['textMuted', 'ivory-faint'],
    ['textOnAccent', 'ivory-on-ink'],
    ['gold', 'ivory-champagne'],
    ['goldText', 'ivory-champagne-text'],
  ])('keeps %s in step with the web --%s token', (mobileKey, cssToken) => {
    expect(colors[mobileKey as keyof typeof colors].toLowerCase()).toBe(webToken(cssToken));
  });

  it.each(Object.entries(textSafeColors))(
    '%s stays readable on every surface it can land on',
    (_name, value) => {
      for (const background of textBackgrounds) {
        expect(contrast(value, background)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('keeps the decorative tones out of the text-safe set', () => {
    // gold and textMuted are intentionally below 4.5:1. This asserts the split is real, so nobody
    // "fixes" the contrast test later by quietly adding them to textSafeColors.
    for (const decorative of [colors.gold, colors.textMuted]) {
      expect(Object.values(textSafeColors)).not.toContain(decorative);
      expect(contrast(decorative, colors.surface)).toBeLessThan(4.5);
    }
  });
});
