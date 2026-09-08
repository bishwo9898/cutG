# Landing page and auth — working notes

Last updated: September 8, 2026 (round 1)

The state of the public marketing page and the sign-in screens, so the next round does not have to
re-derive any of it. `docs/MOBILE_APP_PLAN.md` is the same thing for `apps/mobile`.

## Where the styling actually lives, and why that matters

This is the first thing to know, because it caused the bug this round started with.

Stylesheets load in this order (`src/app/layout.tsx`), and **later files win**:

```
globals.css → ivory-tokens → ivory-shared → ivory-landing → ivory-client → ivory-barber
            → ivory-responsive → ivory-contrast
```

`globals.css` is **12,800 lines** of pre-redesign CSS. The `ivory-*` sheets are the current design
system layered on top. Plenty of components are therefore defined **twice**, and the second
definition only partly overrides the first — which is how you get rules that half-work.

**Rule of thumb: put landing changes in `ivory-landing.css`, and check whether `globals.css`
already defines the same class before adding anything.**

## Round 1 — the flip word, the nav, the scroll, the preview, and sign-in

**The "whenever / wherever" swap was fighting itself.** It was defined in both `globals.css` and
`ivory-landing.css`. Globals built a 3D `rotateX` flip; the landing sheet then cancelled it with
`perspective: none` and replaced the motion with a slide — *and* set `overflow: hidden` on a box
exactly `1.12em` tall. A large serif italic does not fit in its own em box, so every swap sliced
the outgoing word off partway through. That is the "not smooth, not completely visible".

It is one definition now, in `ivory-landing.css`, and nothing is clipped: the two words sit on top
of each other and cross-fade with a 0.16em rise. Both are fully legible from the first frame to the
last, with a steady champagne rule underneath so the eye has a fixed thing to hold.

**The nav reacts without re-rendering.** Scroll state is written straight to the DOM — a class
toggle and a `--nav-progress` custom property, coalesced to one write per animation frame. Putting
a progress value through `useState` would re-render the nav, and everything Clerk hands it, sixty
times a second while somebody is merely scrolling. On top of that: it compacts once you leave the
hero, a hairline shows how far through the page you are, and an IntersectionObserver anchored on
the middle 10% of the viewport keeps the current section's link underlined.

**Scrolling is assisted, not taken over.** `scroll-snap-type: y proximity` on the root scroller,
scoped with `html:has(.landing-cinematic-page)` so the portals are untouched. Proximity, not
mandatory, is the whole point: mandatory seizes the scroll and yanks the page around, which is the
opposite of not noticing it is there. Proximity only finishes a gesture that was already most of
the way to a section.

For that to land well the sections have to fit the screen, so they are
`min-height: calc(100svh - var(--landing-nav-h))` with `scroll-padding-top` set to the same
variable — a snapped section fills exactly the space under the bar. Getting there meant sizing the
slider and the route map in `svh` rather than pixels, and trimming some generous padding. At
1440×900 every section now fits except **for-barbers, which is 22px over** (2.5%); closing that
last gap would mean cramping the pricing cards, which is not worth it.

Snapping is **off below 861px** — phone sections are naturally taller than the viewport and
snapping them to the top would strand headings off-screen.

**The before/after preview is back.** It had not been deleted; it was inside
`{AI_STUDIO_PUBLIC && ...}`, so turning the AI studio off took the whole section with it. It is
ungated now and rebuilt as a two-column layout — copy on one side, the wipe on the other — which
let the image roughly double in size while the section still fits a screen. Stacked, it had to stay
small and floated in empty canvas.

Its call to action points at **`/client/start`, not `/client/design`**: the studio behind it is
still being built and a visitor must not be dropped into it. There is a test pinning that.

**Sign-in is one centred column with no imagery.** It was a two-column split with a full-bleed
photograph filling the left half — an image download on the one screen where somebody is trying to
do a single thing, with the two fields they came for pushed to one side. `AuthShell` now renders
`auth-shell*` classes, deliberately new names, so none of the five scattered places that styled the
old split can reach it. A test asserts the shell renders no `<img>` and no `url(` at all.

Also removed: a remote `images.unsplash.com` background that `globals.css` was loading on every
auth page.

## What I found and did not change

- **`.market-hero::after` still loads a remote Unsplash image**, on the signed-in customer home
  (`client-home.tsx`). It is a real external request on a live page. Out of scope this round, but
  it is the next easy performance win on the web side.
- **`.preview-cover` and `.landing-hero` are dead CSS** — no TSX references either, and both carry
  remote Unsplash URLs. Safe to delete whenever someone is in there.
- **`globals.css` is 12,800 lines** and duplicates much of the `ivory-*` system. Worth a dedicated
  pass; every duplicate is a future version of this round's flip-word bug.

## Not verified, and why

The **snap gesture itself** was never felt. Proximity snapping only engages on real input, and
scripted scrolling does not trigger it; the browser pane here could not deliver a wheel gesture.
What is verified is the geometry — snap properties applied, sections sized to the space under the
nav, `scroll-padding-top` matching — measured in the live page at 1440×900, 1100×800 and 375×812.

Screenshots of a **scrolled** page come back blank or stale in this environment; only the top of
the document captures reliably. To look at a lower section, hide its siblings in the console and
scroll to the top:

```js
[...document.querySelectorAll('.landing-cinematic-page > section')]
  .forEach(s => { if (s.id !== 'tracking') s.style.display = 'none'; });
scrollTo(0, 0);
```

## Queue

1. **Feel the scroll on a real browser.** Everything above is measured, not felt.
2. **The remote Unsplash image on the customer home** (`.market-hero::after`).
3. **Delete the dead `globals.css` blocks** — `.preview-cover`, `.landing-hero`, and the old
   `.auth-page` / `.auth-brand` split now that nothing renders it.
4. **The before/after assets are nearly identical.** The two photos differ so little that the wipe
   reads as a rendering artefact rather than a haircut. Better pair needed.
5. **Restore the studio CTA** in `HairDesignSlider` when AI Hair Studio ships — pass `ctaHref`.
