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
- Context: The root tree is live on production, the auth code was restored in commit `7001fa4`, and the latest local admin refactor now introduces a persistent sidebar plus a dedicated `/admin/media` route. Browser-level verification still has not been performed in this session.
- Risk: Build status is confirmed, but a real browser pass is still needed to confirm `/admin` accepts the corrected credentials, the new admin navigation and media grid behave correctly, video thumbnails populate as expected, and `/gallery` plus `/live` still behave normally.
- Next action: Open the live site in a browser and confirm `/admin`, `/admin/media`, homepage spotlight ordering, video thumbnails, `/gallery`, and `/live` all behave as intended.

## ISSUE-2026-04-05-001 | Live-mode override is temporary in-memory state only

- Status: Open
- Severity: Low
- Context: `data/liveConfig.js` stores `isLiveOverride` in process memory so `/admin/live` can toggle the homepage banner and `/live` state without touching existing admin actions or persistence layers.
- Risk: The toggle resets on restart, deploy, or serverless cold start, so operators cannot rely on it as a durable live-state flag.
- Next action: Leave as-is unless the user asks for persistent live-state storage or automatic Twitch status detection.

## ISSUE-2026-04-06-001 | Admin UX refactor still needs browser-level verification

- Status: Open
- Severity: Medium
- Context: `cmd /c npx tsc --noEmit` and `cmd /c npm run build` now pass locally, but the admin changes were validated only by build/type checks and code inspection.
- Risk: Without a browser pass, small layout or interaction issues in the new sidebar shell, pagination flow, or thumbnail backfill path could still be present.
- Next action: Browser-test `/admin`, `/admin/media`, starring, hiding, editing, and missing-thumbnail behavior with a real populated library.
