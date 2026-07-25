# Extractable Components

This repo has reusable portal components, but the public landing redesign target is currently an inline page rather than a shared shell. For this design pass, there are no must-extract layout components that materially improve the landing draft inside Superdesign.

## ClientHeader

- Source: `apps/web/src/components/client-header.tsx`
- Category: layout
- Description: marketplace shell for authenticated and unauthenticated client-facing pages
- Extractable props: none recommended for this landing redesign pass
- Hardcoded: cutG brand, nav labels, account menu structure, iconography

## BarberCard

- Source: `apps/web/src/components/client-ui.tsx`
- Category: basic
- Description: public discovery card showing barber image, verification, ratings, pricing, and CTA
- Extractable props: barber data object, `showSave`, `query`
- Hardcoded: card layout, mobile badge presentation, CTA structure

## Notice

- Source: `apps/web/src/components/notice.tsx`
- Category: basic
- Description: shared inline notice with tone-based iconography
- Extractable props: `tone`, `children`
- Hardcoded: icon mapping and wrapper class names

Skip recommendation for this task:

- Do not extract components before the initial landing-page draft.
- The redesign brief wants a new luxury public marketing composition, not a portal-shell clone.
- Reusing the client header or barber card literally would bias the design back toward the current marketplace look instead of the requested premium editorial landing page.
