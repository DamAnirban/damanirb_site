# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal portfolio site for anirbandam.com — a fully static Astro 7 site styled with Tailwind CSS v4, deployed on Netlify.

## Commands

- `npm run dev` — dev server at `localhost:4321`. When starting it from an agent, use background mode: `astro dev --background`, managed with `astro dev stop`, `astro dev status`, `astro dev logs`.
- `npm run build` — production build to `dist/` (this is also Netlify's build command; Node 22, `>=22.12.0` required).
- `npm run preview` — serve the built `dist/` locally.

There is no lint or test setup. `npm run build` is the main verification step (TypeScript uses `astro/tsconfigs/strict`).

## Architecture

- **Routing**: file-based, one `.astro` file per page in `src/pages/`. Every page wraps its content in `src/layouts/Layout.astro`, which requires `title` and `description` props and derives canonical URL, Open Graph, and Twitter meta from them — so pages set SEO only through those two props.
- **Layout** also injects `Nav` and `Footer`, the skip-to-content link (targets `#main`), and preloads the two latin woff2 font files. Nav links are hard-coded arrays in `src/components/Nav.astro`: `links` for top-level pages and `tools` for the "Common Tools" dropdown (a non-link button that opens on hover, or by tap/Enter for touch and keyboard users). New pages must be added there (and to the footer if relevant) manually.
- **Tools** live under `src/pages/tools/`. The Work Week calendar is built at build time from `src/lib/workWeek.ts` (Sun–Sat weeks, ww1 = the week containing Jan 1, so late-December days can be ww1 of the next year — this matches the team's convention, not ISO 8601; the years shown are the `YEARS` array in the page, each rendered as a slide switched by the edge arrows or arrow keys). On desktop the page is locked to one viewport height (`calc(100dvh-73px)`, the nav height) so the year fits without scrolling; "today" is highlighted client-side in the viewer's timezone.
- **Styling**: Tailwind v4 via the `@tailwindcss/vite` plugin — no `tailwind.config.js`. Design tokens live in the `@theme` block of `src/styles/global.css` and produce utilities like `bg-canvas`, `text-primary`, `bg-blush`, `text-coral`, `font-display`, `font-body`. Use these tokens rather than raw hex values.
- **Color contrast rule** (from `global.css`): `secondary` and `coral` fail 3:1 against `canvas`, so use them only decoratively (borders, rings, icons, eyebrow accents) — never as body text on a light fill.
- **Visual system**: `Layout.astro` draws a shared page-top backdrop (dot grid via the `bg-dots` utility plus blurred blush/secondary blobs) behind every page, so page sections should keep transparent backgrounds at the top. Section eyebrows are a coral dash + `text-primary` uppercase label. `CircuitTraces.astro` is a decorative SVG coloured via `text-*`. Custom utilities (`bg-dots`, `mask-fade-*`) and animations (`animate-float`, `animate-spin-slow`) are defined in `global.css`.
- **Scroll reveal**: add `data-reveal` (optionally `style="--reveal-delay: 100ms"`) to fade an element in on scroll. Elements are hidden only when `<html>` has the `js` class (set inline in the head), and the reveal sets its own `transition`, so put `data-reveal` on a wrapper rather than on an element with hover transitions.
- **Accessibility conventions**: interactive elements consistently use `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-<bg>`; match the offset color to the background the element sits on. Global CSS disables animations under `prefers-reduced-motion`.
- **Images**: source images live in `src/assets/images/` and are rendered with `<Picture>` from `astro:assets` using `formats={['avif', 'webp']}`. Only favicons and `robots.txt` go in `public/`.
- **Fonts**: self-hosted via `@fontsource-variable` (Inter for body, Space Grotesk for `h1`–`h4`/display) — no external font CDN.
- **Config**: `astro.config.mjs` sets `site` (used for canonical URLs and the `@astrojs/sitemap` integration) and enables `prefetchAll` with the `viewport` strategy.
- **Deployment**: `netlify.toml` defines the build and long-lived cache headers for `/_astro/*` (content-hashed) and favicons.
- The privacy policy states the site sets no cookies, has no forms, and collects no personal data; adding analytics, forms, or third-party embeds means updating `src/pages/privacy-policy.astro` too.

## Astro documentation

Full docs: https://docs.astro.build. Consult before related work:

- [Routing, dynamic routes, middleware](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Framework components (React, Vue, Svelte…)](https://docs.astro.build/en/guides/framework-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling and Tailwind](https://docs.astro.build/en/guides/styling/)
- [Internationalization](https://docs.astro.build/en/guides/internationalization/)
