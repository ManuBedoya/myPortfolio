# Portfolio content and design

## Objective

Turn the portfolio into a freelancer sales page: readable design, navigation, real projects with case studies (including Zetta55), a contact form, SEO, and security headers.

## Problem

- Headings use `#8E24AA` on `#1a1a1a` (~2.5:1 contrast, fails WCAG AA even for large text); headings are long marketing sentences.
- No header/navigation; `CTA.astro` exists but is unused; footer year hardcoded (2025).
- Services are six copy-pasted cards; projects have one entry with a placeholder image, duplicated description and a hover-only overlay that fails on touch devices.
- No case-study pages; the strongest project (Zetta55) is missing.
- Only WhatsApp as contact channel.
- No `site` config, canonical, Open Graph, sitemap, robots, or structured data.
- No security headers on Netlify.

## Why

Clients decide on readability, proof of work, and an easy way to get in touch; search engines and link previews need metadata; a public site should ship baseline security headers.

## Scope (authorized)

Review plan tasks 7–12. Decisions taken by the user:
- Public URL: `https://portfoliomanubedoya.netlify.app/`
- Contact form: Netlify Forms (honeypot spam filter).
- Delivery: `stacked-to-main` (this branch stacks on `feat/portfolio-technical-fixes`).

Out of scope: Astro major upgrade, analytics, i18n, blog, automated browser tests runner.

## Constraints

- Astro 5.4.2 + Tailwind v4 `@theme` tokens, static output, Netlify.
- UI copy in Spanish (existing site language), neutral/professional register; code, comments, commits in English.
- Facts about projects only from verified sources: Zetta55 = Astro, Cloudflare Pages, Resend form forwarding, Sanity CMS admin module, apartments for rent in Chapinero (Bogotá), image from its public og:image. Freshcold = Astro + Tailwind food company site (existing data). No invented metrics or client quotes.
- No new external runtime scripts. CSP must keep working with the inline reveal script.

## Tasks

- [x] T1 — Visual and navigation: accessible heading color token (≥ 4.5:1 on `primary-dark`), shorter headings, sticky header with anchor nav + accessible mobile menu, integrate `CTA.astro` before the footer, dynamic footer year.
- [ ] T2 — Data-driven sections: `src/data/services.ts` + `ServiceCard.astro`; projects as an Astro content collection (`src/content/projects/*.md`, typed schema: title, summary, image, stack, highlights, url, featured, order); add Zetta55 (local image from its og:image) and migrate Freshcold; fix `ProjectCard` (single description, no hover-only content, correct link labels); remove `src/data/projects.ts`.
- [ ] T3 — Case-study pages: `/proyectos/[slug]` rendering collection body (context, solution, stack, highlights, live link) with shared layout and back navigation; cards link to them.
- [ ] T4 — Contact section: Netlify Forms (`data-netlify`, honeypot, labels, required fields, `action="/gracias"`), thank-you page, nav link; WhatsApp kept as secondary channel.
- [ ] T5 — SEO: `site` in `astro.config.mjs`, `@astrojs/sitemap`, `public/robots.txt`, canonical, Open Graph/Twitter tags with per-page title/description/image, `Person` JSON-LD.
- [ ] T6 — Security headers: `netlify.toml` (build settings + CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors`), inline scripts allowed by SHA-256 hash, `postbuild` check that fails when hashes in `dist` don't match the CSP.

## Acceptance criteria

- `npm run build` succeeds; every page in `dist` builds.
- Heading color contrast ≥ 4.5:1 on `#1a1a1a` (computed and recorded).
- Header nav links resolve to existing section ids; mobile menu operable by keyboard with `aria-expanded`.
- Zetta55 and Freshcold appear on the home page and each has a `/proyectos/<slug>/` page.
- `dist/index.html` contains a form with `data-netlify="true"`, a honeypot field, and labelled inputs; `/gracias/` exists.
- `dist/sitemap-index.xml`, `dist/robots.txt`, canonical and `og:image` absolute URLs exist.
- `netlify.toml` CSP has no `unsafe-inline` for scripts; the hash check passes on build.

## Checks

- Test-first exception: no test runner; checks are structural on `dist/` plus the CSP hash check script (which becomes the regression guard for T6).
- `npm run build` after each task.

## Delivery

- Branch: `feat/portfolio-content-design` (from `c18bd25`).
- Forecast: ~1,000 authored changed lines — above the ~400 budget. Strategy cached: `stacked-to-main`.
- Planned slices: PR C = T1–T2, PR D = T3–T4, PR E = T5–T6.
- Routing: 2+ non-trivial files per task → delegated writer (two runs: T1–T3, then T4–T6).

## Progress

| Task | Route | Commit | Review |
|---|---|---|---|
| T1 | delegated writer (run 1) | see git log | pending assess |

## Next step

Delegate T1–T3 to one writer.
