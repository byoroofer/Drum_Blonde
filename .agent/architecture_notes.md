# Architecture Notes

Last updated: `2026-04-06T11:06:34.5373348-05:00`

## Top-Level Shape

- `app/page.js` is the recovered-style homepage and now reads `data/liveConfig.js` to prepend a thin `/live` banner when manual live mode is enabled.
- `app/page.js` now keeps admin access out of the topbar; the only public admin entry point is a subdued footer link.
- `app/gallery/page.js` is the separate public image-thumbnails page and pulls visible image assets from `getHomepageMedia()`.
- `app/live/page.js` is a standalone Twitch stream surface with Twitch player/chat embeds and local page-scoped styling.
- `app/admin/` contains the operator dashboard UI, review forms, server-side actions, and a new protected `/admin/live` console.
- `app/api/jobs/run/route.js` is the protected worker endpoint.
- `app/api/google-photos/picker/*` exposes picker session and import routes.
- `_recovered_5ss2_clean/src/app/admin/` is the current production admin baseline and now includes its own picker-based Google Photos import panel and `/api/admin/google-photos/picker/*` routes.

## Core Control Points

- `core/env.ts` parses env vars, exposes readiness checks, and enables demo mode when Supabase credentials are missing.
- `core/repository.ts` is the main data/service layer. It fetches dashboard state, maps database rows, writes audit logs, creates publish jobs, and handles review transitions.
- `core/publishing.ts` resolves execution mode and builds manual-handoff payloads. Current MVP behavior remains manual-first unless live publishing and a valid connected account are both present.
- `core/platforms.ts` defines platform policy and default execution posture.
- `core/google-photos-picker.ts` and `core/video.ts` handle import and media inspection helper work.
- `data/liveConfig.js` is the current live-stream control point. It exposes `twitchChannel`, `showChat`, `isLiveOverride`, plus helper functions backed by a `globalThis` in-memory store.
- `lib/admin-auth.js` is the active root-tree admin auth control point. `/admin`, `/admin/live`, and `/api/admin/*` use its env-backed cookie session checks; the separate `core/auth.ts` Supabase flow exists in the repo but is not wired into these routes.
- `lib/media-repo.js` is the homepage curation control point. `buildHomepageSelection()` now requires `featuredHome === true` for both image and video homepage candidates before slot/smart-score ordering is applied.
- `_recovered_5ss2_clean/src/lib/google-photos-picker.js` is the recovered production helper that creates picker sessions, polls picked items, downloads selected media, and hands files off to `_recovered_5ss2_clean/src/lib/media-repo.js`.
- `db/schema.sql` is the source schema for local DB setup.

## Request and Job Flow

1. A dashboard page or API route collects ingest, review, or publish input.
2. `core/repository.ts` persists assets, captions, tags, targets, jobs, and audit events through Supabase/Postgres.
3. `scripts/run-worker.mjs` calls `POST /api/jobs/run` with `WORKER_SHARED_SECRET`.
4. `core/publishing.ts` either returns a manual handoff payload or a failed direct-publish result.
5. Publish-job status and attempt logs are written back into the repository layer.

## Operational Invariants

- Manual handoff is the truthful default when direct API posting is not fully wired or approved.
- Missing Supabase env vars should degrade to demo mode, not a broken dashboard.
- Production homepage recovery work must treat `D:\Drum_Blonde\_recovered_5ss2_clean\src` as authoritative until the user says otherwise.
- The recovered production Google Photos path now depends on Google Picker API credentials that include `photospicker.mediaitems.readonly`.
- The current live-mode toggle is intentionally temporary and process-local; it is not persisted to Supabase, files, or existing admin actions.
- Root admin access must fail closed when `ADMIN_*` env vars are missing or the signed `drum_blonde_admin` cookie is absent/invalid; `lib/admin-auth.js` should not be left in a permissive stub state.
- Thumbnail generation in the root media engine is best-effort and should not block ingestion; homepage/admin preview rendering expects dedicated thumbnail paths rather than falling back to raw video files.

## Coupling and Caution Areas

- The root codebase mixes JavaScript and TypeScript. Keep edits localized and match surrounding conventions.
- `package.json` exposes build/runtime scripts but no dedicated lint or test scripts, so validation depends mainly on build and targeted checks.
- The working tree already contains unrelated local changes outside this initialization task. Do not revert them.
