# Open Issues

Track unresolved bugs, risks, and follow-ups. Close or update entries when the state changes.

## ISSUE-2026-04-01-002 | No dedicated test or lint script in the root repo

- Status: Open
- Severity: Medium
- Context: Root `package.json` exposes `dev`, `check:env`, `db:setup`, `build`, `start`, and `jobs:run`, but no `test` or `lint`.
- Risk: Validation is inconsistent and currently depends on build-only or ad hoc checks.
- Next action: Add an agreed validation script set and document it in `AGENTS.md` and `project_overview.md`.

## ISSUE-2026-04-01-003 | Existing unrelated local changes are present in the working tree

- Status: Open
- Severity: Medium
- Context: `git status --short` showed pre-existing changes in `.env.example`, `components/google-photos-picker-panel.tsx`, `core/env.ts`, `core/google-photos-picker.ts`, `scripts/check-env.mjs`, plus many user-owned recovered-source files under `_recovered_5ss2_clean/src/`.
- Risk: Future agents could accidentally overwrite or revert user work while handling unrelated tasks.
- Next action: Treat those files as user-owned changes unless the user explicitly asks to modify them.

## ISSUE-2026-04-01-004 | Recovered production deploy expects `media_albums`, but schema apply is still blocked from this machine

- Status: Open
- Severity: Medium
- Context: The recovered app was deployed to production successfully, but the Vercel build logged a fallback warning that `public.media_albums` is missing from the schema cache. The direct database host resolves only to IPv6 from this machine, IPv6 connectivity is unavailable here, and the exact Supabase shared-pooler connection string is not present in the current env.
- Risk: Album-related homepage/admin features may fall back or be partially degraded until the recovered schema is applied to the database.
- Next action: Run `_recovered_5ss2_clean/src/db/schema.sql` in Supabase SQL Editor, or provide the exact `Session pooler` / `Transaction pooler` connection string from Supabase Connect so the apply can be retried over IPv4.

## ISSUE-2026-04-01-005 | Current Google token still cannot create Google Photos Picker sessions

- Status: Open
- Severity: High
- Context: On `2026-04-02`, local `.env.local` was updated with a newly authorized refresh token tied to the existing OAuth client, and a direct `POST https://photospicker.googleapis.com/v1/sessions` probe then succeeded. Production was then redeployed from the recovered source using the same Google, `ADMIN_*`, and Supabase env overrides.
- Risk: The remaining uncertainty is now end-to-end browser behavior on the public production URL, not the OAuth scope itself.
- Next action: Test the picker on the public production site. If it succeeds, this issue can be downgraded or closed.

## ISSUE-2026-04-03-001 | Root tree deployment verification still needs browser confirmation

- Status: Open
- Severity: Low
- Context: The root tree was already live on production, and the `2026-04-06` admin-login repair restores auth gating in code. Deployment/build status can be confirmed separately, but no browser-level verification of `drumblonde.tjware.me`, `/gallery`, `/live`, the admin login screen, or post-login admin behavior was performed in this session.
- Risk: Production may be deployed yet still needs a real browser pass to confirm unauthenticated `/admin` access redirects to `/admin/login`, valid sign-in reaches the dashboard, and the existing homepage/media behavior remains intact.
- Next action: Open the live site in a browser and confirm the homepage shows only star-marked media, thumbnails render correctly, `/gallery` loads, `/live` behaves as expected, and `/admin` now requires login end-to-end.

## ISSUE-2026-04-05-001 | Live-mode override is temporary in-memory state only

- Status: Open
- Severity: Low
- Context: `data/liveConfig.js` stores `isLiveOverride` in process memory so `/admin/live` can toggle the homepage banner and `/live` state without touching existing admin actions or persistence layers.
- Risk: The toggle resets on restart, deploy, or serverless cold start, so operators cannot rely on it as a durable live-state flag.
- Next action: Leave as-is unless the user asks for persistent live-state storage or automatic Twitch status detection.
