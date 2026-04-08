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

## ISSUE-2026-04-06-002 | Homepage reel-library layout still needs browser-level visual verification

- Status: Open
- Severity: Medium
- Context: The homepage hero was refactored on `2026-04-06` to a three-across featured video wall plus a six-tile reel library with zero internal gaps, and the change was validated only by `cmd /c npm run build` and `cmd /c npx tsc --noEmit`.
- Risk: Without a desktop/mobile browser pass, there is still a chance the edge-to-edge spacing, centered six-tile reel block, or iframe/video cropping differs from the intended Instagram-library look.
- Next action: Browser-check `/` locally or on the next deployed build at desktop and mobile widths, specifically verifying the three large hero videos, the two rows of three smaller videos, and the no-gap tile seams.

## ISSUE-2026-04-07-001 | Real media-editor save flow still needs browser verification on mobile and desktop

- Status: Open
- Severity: Medium
- Context: The admin media library now exposes a real saveable asset editor that rewrites videos via `ffmpeg` and photos via `sharp`, but validation so far only covers `cmd /c npm run build` and `cmd /c npx tsc --noEmit`.
- Risk: Without a real browser pass, the new editor could still have client-side issues around preview playback, form submission, iPhone Chrome interaction, or save-result refresh behavior even though the server-side build succeeds.
- Next action: Browser-test `/admin/media` with at least one video trim/mute save and one image adjustment save on desktop and mobile, confirming preview behavior, successful persistence, and refreshed thumbnails.

## ISSUE-2026-04-07-002 | Spotlight pool behavior still needs live admin verification

- Status: Open
- Severity: Medium
- Context: Spotlight selection now persists as multi-item pool membership via logged `spotlight_home` state and the homepage leader now uses `manual_rank` first within the spotlight pool, but the fix has only been validated by code inspection plus `cmd /c npx tsc --noEmit` and `cmd /c npm run build`.
- Risk: Without a live admin pass, there is still a chance the button state, refresh timing, or homepage leader selection behaves differently against real production data than it does in the static code path.
- Next action: In `/admin/media`, mark multiple videos as spotlight, adjust their rank values, refresh the page, and verify the button states, badges, admin dashboard summary, and homepage spotlight leader all match the expected ordering.

## ISSUE-2026-04-07-003 | Five-minute homepage rotation and admin tile grid still need browser verification

- Status: Open
- Severity: Medium
- Context: The admin homepage-features section now renders a 3-column thumbnail tile grid and homepage video order now rotates on five-minute buckets, but the change has only been verified by `cmd /c npx tsc --noEmit` and `cmd /c npm run build`.
- Risk: Without a browser pass, there is still a chance the tile cropping, edge-to-edge layout, mobile wrapping, or time-boundary rotation behavior differs from the intended design.
- Next action: Browser-test `/admin` and `/` on desktop and mobile, then check again after the next five-minute boundary to confirm the grid layout and active homepage order rotate cleanly.

## ISSUE-2026-04-08-001 | New route-backed media editors still need end-to-end browser save verification

- Status: Open
- Severity: Medium
- Context: `/admin/media/edit/[id]` now launches a dedicated Fabric-based image editor and a browser-first ffmpeg.wasm video editor, and saves now create derived assets through `/api/admin/media/[id]/edits`, but validation so far only covers `cmd /c npm run build` and `cmd /c npx tsc --noEmit`.
- Risk: Without a real browser pass, image-canvas loading, ffmpeg.wasm export, cover-frame capture, mobile controls, or post-save library refresh could still fail against live signed-storage assets even though the server build succeeds.
- Next action: Browser-test one real image edit and one short real video edit from `/admin/media`, confirm the editor route loads directly, save succeeds, the library shows the derived asset metadata, and the original asset remains unchanged.
