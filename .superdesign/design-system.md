# cutG Landing Redesign System

## Product Context

cutG is a barber booking and operations platform with two real sides:

- Clients can discover barbers, browse without friction, book shop or mobile appointments, save favorites, track live journeys, and use the AI Hair Studio to preview a new look before booking.
- Barbers can manage services, availability, bookings, mobile service radius and fees, subscription tier, earnings, and profile visibility.

This redesign is for the public landing page at `/`. It should be a premium brand front door that reflects the existing product truthfully, not a generic SaaS homepage.

## Audience

Two audiences share the page:

- Client audience: wants a trusted barber quickly, hates back-and-forth texting, values mobile service, convenience, clarity, and confidence.
- Barber audience: wants more discovery, better business tooling, and a credible path to grow beyond social DMs and scattered scheduling apps.

Primary emotional objective:

- Quiet confidence
- Intentional craftsmanship
- Premium but not flashy
- Warm and human, not sterile software

## Core Promise

"Your barber, whenever you want. Wherever you are."

Supporting truths that must appear in the design:

- mobile barber service is real
- live tracking is real
- AI hair previews are real
- clients book free
- barber tools include tiered business features

## Visual Direction

The landing page should feel like a renovated legacy barbershop:

- warm graphite instead of pure black
- aged gold/brass accents used sparingly
- editorial serif display moments
- restrained body typography
- broad negative space
- deliberate motion with no playful bounce

Avoid:

- bright startup gradients
- blue-white SaaS defaults
- cyberpunk neon
- flat minimalism with no emotional texture

## Palette

Use these as the design-driving tokens:

```css
--color-bg: #0d0d0f;
--color-surface: #141416;
--color-surface-raised: #1c1c1f;
--color-border: rgba(255, 255, 255, 0.08);
--color-border-strong: rgba(255, 255, 255, 0.15);

--color-gold: #c9a96e;
--color-gold-light: #dec08a;
--color-gold-muted: rgba(201, 169, 110, 0.15);

--color-cream: #f5f0e8;
--color-cream-muted: #a8a39a;
--color-cream-faint: rgba(245, 240, 232, 0.4);

--color-success: #4caf7d;
--color-error: #e05252;
```

Hero glow:

```css
radial-gradient(
  ellipse 80% 60% at 50% -10%,
  rgba(201, 169, 110, 0.12) 0%,
  transparent 70%
)
```

## Typography

Target font pairing:

- Display: `Cormorant Garamond`
- Body: `DM Sans`

Usage:

- Hero and section headlines should feel editorial and lightly set
- Body copy should remain compact, quiet, and legible
- Labels should use uppercase tracking and gold accents

## Motion

- Smooth, calm easing only
- 200ms hover interactions
- 600ms to 900ms reveal cadence
- vertical fade/slide reveals
- `prefers-reduced-motion` respected

No bouncy or playful motion.

## Page Architecture

1. Fixed minimal nav
2. Full-height hero
3. AI Hair Design showpiece with before/after slider
4. Mobile Barber differentiator
5. Three-step experience
6. Live tracking story moment
7. Barber-focused business section
8. Social proof
9. Pricing preview
10. Final two-path CTA
11. Minimal footer

## Conversion Rules

- Let client CTA lead into browsing before signup when possible
- Keep barber CTA visible but secondary until barber-focused sections
- Speak in outcomes, not platform jargon
- Use believable social proof
- Keep sections concise; dark space is part of the luxury feel

## Image / Media Direction

- Hair preview section should use the real portrait-driven AI story, not stock models
- Map/tracking visuals should feel elegant and product-like, ideally drawn through CSS/SVG styling
- Photography, if present, should feel cinematic and authentic, not overproduced fashion-ad imagery

## Accurate Routes

- Client primary CTA: `/client/register` or browse path `/client/barbers`
- Barber CTA: `/barber/register`
- AI preview CTA: `/client/design`
- Mobile barber CTA: `/client/barbers?mobileOnly=true`

## Draft Goal

Create a landing page concept that is unmistakably cutG, more premium than the current homepage, and believable as the front door to a product that already supports AI hair previews, mobile barber service, live tracking, and barber business tooling.
