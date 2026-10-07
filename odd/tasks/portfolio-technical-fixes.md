# Portfolio technical fixes

## Objective

Fix the verified technical defects of the portfolio (styling pipeline, assets, performance, supply-chain risk, animation robustness) without changing copy or design decisions.

## Problem

- `tailwind.config.mjs` is ignored by Tailwind v4: custom color classes (e.g. `text-muted-light`) are not generated (verified in `dist/_astro/*.css`).
- `global.css` uses v3 `@tailwind` directives.
- Favicon referenced at `/favicon.svg` but lives at `/images/favicon.svg` (404).
- Hero photo uses `.webP` extension; unused 816 KB `profilePhoto.jpg`.
- ~540 KB of fonts: 4 `@fontsource` packages plus Google Fonts Inter; Onest and Luckiest Guy unused.
- Phosphor Icons loaded from unpkg without version pin or SRI (render-blocking, supply-chain risk).
- Fade-in IntersectionObserver registered twice; sections stay invisible without JS; no `prefers-reduced-motion`.
- Dead components, icons, assets, and images.

## Why

Correct rendering, smaller payload, no third-party script execution, accessible motion, and a clean base for the next design/content work.

## Scope (authorized)

Tasks 1–6 of the review plan. Out of scope: copy changes, contrast/palette redesign, navigation, services/projects data refactor, Zetta55 project, contact form, SEO, security headers (tasks 7–12).

## Constraints

- Astro 5 + Tailwind v4 (`@tailwindcss/vite`), static output, hosted on Netlify.
- Visual output must stay equivalent (same colors, same layout).
- Generated artifacts in English; existing Spanish UI copy untouched.

## Tasks

- [x] T1 — Remove dead code: unused components (`components/Layout.astro`, `Projects.astro`, `footer/Footer.astro`, `information/*`), unused icons (GitHub, Instagram, LinkedIn), `src/assets/*`, unused images (`blogFilosofias`, `botSocialMedia`, `consoleAirBnB`, `vcsoft.png`, `profilePhoto.jpg`). Keep `CTA.astro` (planned for task 10).
- [x] T2 — Tailwind v4 theme: move palette to `@theme` in `global.css`, drop v3 directives, delete `tailwind.config.mjs`, replace hardcoded hex classes with theme tokens.
- [x] T3 — Fonts: keep Inter variable (+ Poppins weights in use), remove Onest, Luckiest Guy, Google Fonts link and preconnects; uninstall unused packages.
- [x] T4 — Replace Phosphor CDN script with inline SVG icon components.
- [x] T5 — Assets: fix favicon path, rename `profilePhoto.webP` → `profile-photo.webp`, use `astro:assets` `<Image>` with explicit dimensions for the hero photo, add `initial-scale=1` to viewport.
- [x] T6 — Single fade-in implementation: one observer in the layout, content visible without JS (progressive enhancement class on `<html>`), respect `prefers-reduced-motion`.

## Acceptance criteria

- `npm run build` succeeds with no warnings about unknown directives.
- Built CSS contains the theme color utilities used by components.
- No request to `unpkg.com` or `fonts.googleapis.com` in `dist/index.html`.
- `dist/favicon.svg` exists and is referenced.
- Hero image emitted with `width`/`height` attributes.
- Sections visible with JS disabled; no animation under `prefers-reduced-motion: reduce`.

## Checks

- Test-first exception: no test runner in the project; checks are structural (build output inspection via `rg` on `dist/`).
- `npm run build` after each task.

## Delivery

- Branch: `feat/portfolio-technical-fixes`
- Forecast: ~530 authored changed lines (≈250 deletions of dead code) — above the ~400 budget.
- Strategy: `ask-on-risk` → chain strategy `stacked-to-main` (user choice).
- Slices: PR A = T1 (dead code removal, 238 deletions); PR B = T2–T6.

## Progress

| Task | Route | Commit | Review |
|---|---|---|---|
| T1 | inline (mechanical deletions, refs checked with `rg`) | see `git log` (`chore: remove unused components and assets`) | approved (review-54ab2098f7fb3986) |
| T2 | delegated writer | 746fcc1 | approved (review-54ab2098f7fb3986) |
| T3 | delegated writer | 3b48dd7 | approved (review-54ab2098f7fb3986) |
| T4 | delegated writer | 588e895 | approved (review-54ab2098f7fb3986) |
| T5 | delegated writer | 95da170; hero source is 288x288, so width/height 288 (576 would upscale) | approved (review-54ab2098f7fb3986) |
| T6 | delegated writer | see `git log` (`fix(motion): make section reveal progressive and motion-safe`) | approved (review-54ab2098f7fb3986) |

## Review

- Assess: medium (`package-lock.json` config change), `slice_budget_reached` (740 lines, main..6ab1d51). User granted consent.
- Outcome: approved by reliability lens, acknowledged. Advisory (non-blocking) follow-ups:
  - R3-reveal-module-dependency — `js` class is set inline in `<head>` but reveal logic lives in the bundled body script; if it fails, sections stay hidden. Fix: CSS/timeout fallback.
  - R3-no-automated-reveal-check — no automated check for no-JS / reduced-motion reveal.
  - R3-bg-opacity-noop — `bg-opacity-20` in `ProjectCard.astro:25` is a no-op in Tailwind v4.

## Next step

Fix R3-reveal-module-dependency and R3-bg-opacity-noop as a small follow-up, then tasks 7–12 (design/content) as a new feature. Push and PRs (stacked-to-main: PR A = 376e8f4, PR B = 746fcc1..6ab1d51) are the user's decision.
