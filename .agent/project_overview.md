# Project Overview

Last updated: `2026-04-06T11:06:34.5373348-05:00`

## Summary

- Project: Drum Blonde / Brooke Creator Distribution System.
- Stack: Next.js App Router, React 19, TypeScript-enabled mixed JS/TS codebase, Supabase, Postgres, Vercel, `ffmpeg-static`, and `ffprobe-static`.
- Product goal: ingest creator media once, generate platform-ready packaging, queue official publishing where supported, and fall back to manual handoff when automation is not ready or should not be faked.

## Current Operational State

- The approved production recovery source is `https://drum-blonde-5ss2t9n2z-byoroofers-projects.vercel.app`.
- The recovered source tree for that approved deployment is `D:\Drum_Blonde\_recovered_5ss2_clean\src`.
- Root `app/page.js` is now the recovered-style homepage with a minimal conditional live banner wired to `data/liveConfig.js`.
- A public `/live` route now exists for Twitch streaming embeds, and `/admin/live` provides a protected manual live-mode console.
- Root `/admin` and `/api/admin/*` now rely on the restored env-backed login flow in `lib/admin-auth.js`; the login screen should render again for unauthenticated access.
- Homepage media selection now hard-gates on `featuredHome === true`, so only star-marked assets are eligible for homepage rotation.
- A public `/gallery` route now exists so image thumbnails live on a separate page instead of competing with the homepage video stack.
- Production-facing fixes should still be validated against the recovered source tree before build or deploy activity.
- Current production deploy alias: `https://drum-blonde.vercel.app` -> `https://drum-blonde-jxc5xdube-byoroofers-projects.vercel.app`.
- The app can render in read-only demo mode when required Supabase env vars are missing.

## Repo Map

- `app/`: public page, admin pages, layouts, and API routes.
- `components/`: shared UI and feature panels.
- `core/`: environment parsing, data/repository layer, platform catalog, publishing rules, auth, demo data, and media helpers.
- `data/`: static content used by the app.
- `db/`: SQL schema.
- `scripts/`: env check, schema setup, and worker trigger scripts.
- `public/`: static images and media.
- `types/`: supplemental typings.
- `_recovered_5ss2_clean/src/`: authoritative recovered snapshot for production reconciliation.
- `.agent/`: persistent project memory for future sessions.

## Runbook

- Install: `npm install`
- Env validation: `npm run check:env`
- Database setup: `npm run db:setup`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Production server: `npm run start`
- Worker trigger: `npm run jobs:run`
- Extra validation when needed: `npx tsc --noEmit`

## External Dependencies

- Supabase Auth, Postgres, and Storage for operator accounts, data, and media.
- Vercel for deployment and deployment history.
- Google Photos Picker integration now exists in both the root tree and the recovered production tree, but it requires a Google token minted with `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
- Optional `OPENAI_API_KEY` support exists for smart-import enrichment paths.
- Twitch is embedded directly on `/live`; no persistent stream-state backend exists yet.
- Root `lib/media-repo.js` now includes best-effort thumbnail generation with `sharp` for images and `ffmpeg` frame capture for videos.

## Current Constraints

- Direct publishing is intentionally conservative. Manual handoff remains the honest default for unsupported or unconfigured lanes.
- There is no committed root `test` or `lint` script yet.
- Sensitive files such as `.env.local`, pulled env dumps, and browser-profile artifacts should not be copied into memory logs.
- The root repo has unrelated local modifications; future tasks must not overwrite them casually.
- The recovered production app still logs `media_albums` schema-cache fallback warnings until the database schema is applied.
- The root admin login depends on `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`; if they are missing, admin routes should fail closed instead of bypassing auth.
- `data/liveConfig.js` currently uses in-memory process state for `isLiveOverride`, so the manual live toggle resets on restart/redeploy.
- The root tree changes for the live feature, featured-only homepage selection, separate gallery page, and subdued footer-only admin login were pushed to `main` on `2026-04-06`; the latest Vercel production deployment is `https://drum-blonde-or6ms15an-byoroofers-projects.vercel.app`.
