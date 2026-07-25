# Theme

## Part 1 — Compact Token Summary

Global base tokens from `apps/web/src/app/globals.css`:

- `--ink: #f5f5f2`
- `--muted: #9b9b96`
- `--line: #2a2a28`
- `--surface: #141413`
- `--canvas: #090909`
- `--brand: #f4f4ef`
- `--brand-dark: #ffffff`
- `--accent: #d8d8d1`
- `--warning: #d8b875`
- `--danger: #e17070`
- `--shadow: 0 20px 60px rgba(0, 0, 0, 0.38)`

Current typography:

- No custom font loader in `layout.tsx`
- Serif moments use `Georgia, 'Times New Roman', serif`
- Default body tone is light-on-dark across the marketplace and landing

Current public UI character:

- Backgrounds lean charcoal to near-black
- Buttons are pale ivory or outlined secondary buttons
- Sections rely on large rounded cards and soft borders
- Gold is currently used more as warning/accent than as a full premium brand system

Tailwind setup:

- Tailwind CSS v4 imported directly with `@import 'tailwindcss'`
- No standalone `tailwind.config.ts` is present in `apps/web`

Important scoped themes already in product:

- `.market-page` applies the consumer marketplace look
- `.landing-page` applies the existing public landing look
- `.hair-studio-v2` applies a warmer luxury-like dark theme for the AI preview flow

## Part 2 — Raw Source Dumps / Excerpts

### Root tokens

```css
@import 'tailwindcss';

:root {
  --ink: #f5f5f2;
  --muted: #9b9b96;
  --line: #2a2a28;
  --surface: #141413;
  --canvas: #090909;
  --brand: #f4f4ef;
  --brand-dark: #ffffff;
  --accent: #d8d8d1;
  --warning: #d8b875;
  --danger: #e17070;
  --shadow: 0 20px 60px rgba(0, 0, 0, 0.38);
}
```

### Hair Studio tone excerpt

```css
.hair-studio-v2 {
  min-height: 100vh;
  color: #f3eddc;
  background: #0b0b09;
}

.hair-studio-v2 .eyebrow {
  color: #d5b960;
}
```

### Existing landing-page excerpt

```css
.landing-page {
  background: linear-gradient(180deg, #090909 0%, #111111 35%, #090909 100%);
}

.landing-nav {
  position: sticky;
  top: 0;
  z-index: 10;
}

.landing-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
}

.landing-hero-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: var(--shadow);
}
```

### Marketplace shell excerpt

```css
.market-page {
  min-height: 100vh;
  color: var(--ink);
}

.client-header {
  display: grid;
  grid-template-columns: auto minmax(220px, 420px) auto auto;
}

.market-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.02);
}
```

### Source-of-truth files for deeper context

- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`

For design payload budgeting, use this compact summary first and only range into `globals.css` when a specific selector block is required.
