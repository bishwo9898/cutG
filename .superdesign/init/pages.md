# Key Page Dependency Trees

The trees below focus on the main visual dependency chain for each page. Non-visual helpers such as API clients, plain type files, and formatting utilities are omitted when they do not affect layout or styling.

## `/` (Public Landing)

Entry: `apps/web/src/app/page.tsx`

Dependencies:

- `apps/web/src/app/page.tsx`
  - `apps/web/src/components/client-ui.tsx`
    - `apps/web/src/components/client/barber-cover.tsx`

Notes:

- Current landing navigation and sections are all inline in the page file.
- Featured barber cards reuse the marketplace card component, so the existing landing inherits some marketplace visual language.

## `/client` (Client Home)

Entry: `apps/web/src/app/client/page.tsx`

Dependencies:

- `apps/web/src/app/client/page.tsx`
  - `apps/web/src/components/client-home.tsx`
    - `apps/web/src/components/client-header.tsx`
    - `apps/web/src/components/client-ui.tsx`
      - `apps/web/src/components/client/barber-cover.tsx`

Notes:

- This is the strongest existing consumer-facing design reference in the repo.
- It mixes search, featured barbers, mobile spotlight, AI design teaser, and recently viewed rails.

## `/client/design` (AI Hair Studio)

Entry: `apps/web/src/app/client/design/page.tsx`

Dependencies:

- `apps/web/src/app/client/design/page.tsx`
  - `apps/web/src/components/client-header.tsx`
  - `apps/web/src/components/client/hair-photo-upload.tsx`
  - `apps/web/src/components/notice.tsx`

Notes:

- This page already carries the most premium design language in the current product.
- It is the best visual reference for the warmer editorial direction requested in the landing redesign brief.

## `/barber/dashboard` (Barber Overview)

Entry: `apps/web/src/app/barber/dashboard/page.tsx`

Dependencies:

- `apps/web/src/app/barber/dashboard/page.tsx`
  - `apps/web/src/components/query-states.tsx`
    - `apps/web/src/components/notice.tsx`

Notes:

- This page is operational rather than editorial.
- It is useful product context for what barbers actually get after signup.

## `/barber/dashboard/mobile-service` (Mobile Barber Setup)

Entry: `apps/web/src/app/barber/dashboard/mobile-service/page.tsx`

Dependencies:

- `apps/web/src/app/barber/dashboard/mobile-service/page.tsx`
  - `apps/web/src/app/dashboard/mobile-service/page.tsx` (compatibility re-export)

Notes:

- Product docs confirm this surface manages origin, service radius, travel fees, and enablement for the on-demand mobile feature highlighted on the public site.

## `/client/barbers` (Discovery Index)

Entry: `apps/web/src/app/client/barbers/page.tsx`

Dependencies:

- `apps/web/src/app/client/barbers/page.tsx`
  - `apps/web/src/app/barbers/page.tsx` (compatibility re-export)
  - `apps/web/src/components/client-header.tsx`
  - `apps/web/src/components/client-ui.tsx`
    - `apps/web/src/components/client/barber-cover.tsx`

Notes:

- This route is important for progressive commitment: users can browse before being forced into auth.

## `/client/appointments/[appointmentId]` (Live Tracking / Booking Result)

Entry: `apps/web/src/app/client/appointments/[appointmentId]/page.tsx`

Dependencies:

- `apps/web/src/app/client/appointments/[appointmentId]/page.tsx`
  - `apps/web/src/components/client-header.tsx`
  - `apps/web/src/components/client-ui.tsx`
    - `apps/web/src/components/client/live-tracking-map.tsx`
    - `apps/web/src/components/client/static-map.tsx`

Notes:

- This is the clearest product reference for the live-status timeline and tracking story that the landing redesign should dramatize.
