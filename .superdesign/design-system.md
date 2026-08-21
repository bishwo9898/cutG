# cutG Customer Marketplace and Barber Operations System

## Product Context

cutG connects customers with barbers for shop and mobile appointments. Customers discover nearby barbers, compare services, book and pay, and track a mobile barber's journey. Barbers manage services, appointments, availability, locations, payments, and earnings.

This design pass covers the customer entry, marketplace search, compact barber cards, booking calendar and review, and barber availability on responsive web and native mobile. It must look like one product rather than separate legacy themes.

## Audience and Product Goals

- Customers need the shortest possible path from account creation to a nearby, affordable barber.
- Barbers need dense but understandable operational views that make booked time impossible to overlook.
- The marketplace is still growing, so discovery defaults must remain broad and welcoming.
- Copy must use everyday language. Provider names, raw enums, and implementation terms never appear in rendered UI.

## Visual Direction

Use the existing Ivory system as the only visual source of truth: warm editorial, calm, clean, premium, and practical. The interface is light, with restrained champagne and blush accents. Dark ink is reserved for text and primary actions, never used as an accidental card or hover background.

Avoid:

- black or near-black hover surfaces
- dark text on dark components
- generic blue-white SaaS styling
- oversized cards that stretch when results are sparse
- excessive shadows, gradients, pills, filters, or decorative chrome

## Core Tokens

```css
--ivory-canvas: #f7f3ec;
--ivory-canvas-pink: #fbf4f2;
--ivory-surface: #fffdf9;
--ivory-surface-raised: #ffffff;
--ivory-surface-soft: #f1ebe2;
--ivory-ink: #171513;
--ivory-on-ink: #fffdf9;
--ivory-ink-soft: #37312d;
--ivory-muted: #746b64;
--ivory-faint: #a69a91;
--ivory-line: #ddd4ca;
--ivory-line-strong: #c9bbae;
--ivory-blush: #ead7d3;
--ivory-blush-soft: #f6eae7;
--ivory-champagne: #b29262;
--ivory-champagne-soft: #ede2cf;
--ivory-success: #476a57;
--ivory-warning: #8b6938;
--ivory-danger: #9a504d;
--ivory-shadow-sm: 0 8px 24px rgba(57, 45, 36, 0.06);
--ivory-shadow-md: 0 22px 60px rgba(57, 45, 36, 0.09);
```

Status colors:

- Available/success: muted green ink on pale green
- Pending: amber ink on pale amber
- Journey/travel: blue ink on pale blue
- Arrived: violet ink on pale violet
- In progress: champagne/brown ink on pale champagne
- Cancelled/blocked: red ink on pale red

## Typography

- Display: `Bodoni 72`, Didot, `Iowan Old Style`, Baskerville, Georgia, serif
- Body: `Avenir Next`, Avenir, Inter, system sans-serif
- Display faces are for page and section headings only.
- Controls, cards, labels, prices, and metadata use the body family.
- Normal body text must meet WCAG AA contrast at every state.

## Shape, Spacing, and Motion

- Page max width: 1180px with 20-24px responsive gutters
- Card radii: 14-18px; small controls: 10-12px; status pills: fully rounded
- Base spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40
- Use thin warm-gray borders and small shadows; hover adds a light warm-gray/blush fill and slightly stronger border
- Motion: 150-200ms ease for hover/focus/pressed states; no bounce
- Respect reduced motion

## Customer Entry

- Focused account-first customer screen with cutG identity and concise value copy
- `Create account` is the primary action; `Sign in` is secondary
- Preserve the destination so successful authentication enters marketplace search immediately
- Use `Customer` in visible copy; keep internal `CLIENT` identifiers invisible

## Marketplace Search

- One prominent location autocomplete with a current-location action
- Filters contain only category, distance, and maximum price
- Desktop uses a compact horizontal toolbar; mobile uses a bottom sheet
- Results default broad; active filters are removable chips
- Empty states suggest widening distance or price without blaming the user

## Barber Cards

- Fixed compact width on desktop so sparse results never create giant cards
- Consistent photo ratio, business name, approximate location or distance, rating or `New`, matching starting price, and next availability
- Capability row may show `Mobile visits`, `Online payments`, and a small verified shield
- Mobile and online-payment capability use plain text plus icons; never rely on color alone
- Hover/pressed state is warm light gray or blush, never black

## Booking Calendar and Review

- Service/type summary cards, calendar header, date rail, time slots, review cards, and payment choices all use light Ivory surfaces
- Current/selected items use champagne-tinted backgrounds, dark readable text, and a strong border
- Hover uses `--ivory-surface-soft` or `--ivory-blush-soft`
- Disabled times remain legible and clearly unavailable
- Booking review groups appointment, location, total, and payment choice into scannable cards
- Payment language is `Pay online`, `Pay in person`, `Secure card payment`, and `Complete payout setup`; never name the payment provider

## Barber Availability

- Group slots by date and retain weekly schedule controls
- Available slot: neutral/green tile with explicit `Available`
- Booked slot: crossed or hatched visual, `Booked`, customer name, service, appointment status, and `Review booking`
- Blocked slot: red/dashed treatment with explicit `Blocked`
- Crossing, color, or pattern can reinforce state but can never be the only signal

## Responsive Rules

- Marketplace: four compact columns on wide desktop, two on tablet, one on phone
- Filters collapse into an accessible mobile sheet
- Booking calendar remains horizontally scrollable without clipping labels
- Availability becomes stacked date sections and full-width slot cards on phone
- Native screens mirror information hierarchy and color semantics with pressed states instead of hover

## Accessibility and Content Rules

- Keyboard focus is always visible
- Sliders expose readable value text and an `Any` upper state
- Selected buttons expose `aria-pressed`; active steps expose `aria-current`
- Do not render raw values such as `CARD`, `CASH`, `ON_THE_WAY`, or provider names
- Use concise, customer-facing labels and pair icons with text
