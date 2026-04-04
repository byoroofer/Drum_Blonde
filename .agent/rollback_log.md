# Rollback Log

Record every meaningful file or operational change with enough detail to reverse it safely.

## Entry Template

- Timestamp:
- Change summary:
- Files changed:
- Commands run:
- Rollback steps:
- Rollback verification:

## 2026-04-01T11:40:42.6048954-05:00 | Initialize persistent workflow docs

- Timestamp: `2026-04-01T11:40:42.6048954-05:00`
- Change summary: Expanded the root `AGENTS.md` and created the initial `.agent` memory files.
- Files changed: `AGENTS.md`, `.agent/project_overview.md`, `.agent/architecture_notes.md`, `.agent/work_log.md`, `.agent/decisions.md`, `.agent/rollback_log.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: Repository audit commands listed in `D:\Drum_Blonde\.agent\work_log.md`; file edits applied directly to the markdown docs.
- Rollback steps:
  1. Restore `AGENTS.md` to its pre-initialization recovery-only content.
  2. Remove the new `.agent/*.md` files created by this task.
  3. Re-run a directory listing to confirm `.agent/` is absent or restored to the intended prior state.
- Rollback verification: Open `AGENTS.md` to confirm only the original recovery instructions remain, and verify `Get-ChildItem -Force .agent` no longer returns the newly added files.

## 2026-04-01T12:42:54.4548031-05:00 | Record Google Photos warning investigation

- Timestamp: `2026-04-01T12:42:54.4548031-05:00`
- Change summary: Updated the `.agent` memory files with the diagnosis that the Google Photos warning mismatch appears runtime-specific rather than a missing repo code change.
- Files changed: `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: Investigation commands listed in `D:\Drum_Blonde\.agent\work_log.md`, including source inspection, safe `.env.local` key-presence checks, `npm run check:env`, port/process checks, and a localhost request to `/admin/login`.
- Rollback steps:
  1. Remove the `2026-04-01T12:42:54.4548031-05:00` entries from `.agent/work_log.md`, `.agent/open_issues.md`, and `.agent/rollback_log.md`.
  2. Restore `.agent/session_handoff.md` to the prior snapshot dated `2026-04-01T11:40:42.6048954-05:00`.
  3. Re-open the `.agent` files to confirm only the earlier initialization notes remain.
- Rollback verification: Confirm the newer Google Photos investigation entry is absent from the `.agent` logs and that `.agent/session_handoff.md` no longer mentions the runtime/env mismatch or localhost HTTP 500.

## 2026-04-01T13:00:00-05:00 | Restart local dev server and capture remaining env blockers

- Timestamp: $timestamp
- Change summary: Restarted the local Next dev server outside the sandbox and documented the remaining missing required env vars.
- Files changed: .agent/work_log.md, .agent/rollback_log.md, .agent/session_handoff.md
- Commands run: Stop-Process -Id 33708 -Force; unrestricted detached 
pm run dev; cmd /c netstat -ano | findstr :3000; cmd /c npm run check:env; safe .env.local presence checks.
- Rollback steps:
  1. Stop the new node process listening on port 3000.
  2. Remove the $timestamp entries from .agent/work_log.md and .agent/rollback_log.md.
  3. Restore .agent/session_handoff.md to the previous contents if this restart record should be discarded.
- Rollback verification: Confirm port 3000 is no longer listening from the restarted PID and the $timestamp restart notes are absent from the .agent files.

## 2026-04-01T13:51:26.2251789-05:00 | Fix admin login redirect loop and update local env

- Timestamp: $timestamp
- Change summary: Moved the protected admin layout/page into an App Router route group and added the missing required local env keys so local validation passes.
- Files changed: pp/admin/(protected)/layout.js, pp/admin/(protected)/page.js, pp/admin/layout.js, pp/admin/page.js, .env.local, .agent/work_log.md, .agent/rollback_log.md, .agent/decisions.md, .agent/open_issues.md, .agent/session_handoff.md
- Commands run: Move-Item for the admin files; cmd /c npm run build; cmd /c npm run check:env; cmd /c npm run start; Invoke-WebRequest checks for /admin/login and /admin.
- Rollback steps:
  1. Move pp/admin/(protected)/layout.js back to pp/admin/layout.js.
  2. Move pp/admin/(protected)/page.js back to pp/admin/page.js.
  3. Remove the added .env.local lines for SUPABASE_STORAGE_BUCKET, NEXT_PUBLIC_APP_URL, TOKEN_ENCRYPTION_KEY, and WORKER_SHARED_SECRET if you want to restore the previous local env state.
  4. Re-run cmd /c npm run build and verify /admin/login no longer depends on the route-group change.
- Rollback verification: Confirm pp/admin/(protected)/ is gone, pp/admin/layout.js and pp/admin/page.js exist at their original paths, and /admin/login behavior matches the pre-fix state.

## 2026-04-01T14:05:00-05:00 | Deploy recovered production baseline

- Timestamp: $timestamp
- Change summary: Deployed D:\Drum_Blonde\_recovered_5ss2_clean\src to Vercel production and documented the remaining database-schema blocker.
- Files changed: _recovered_5ss2_clean\src\.env.local (local-only validation copy), .agent/work_log.md, .agent/rollback_log.md, .agent/open_issues.md, .agent/session_handoff.md
- Commands run: 
px vercel deploy --yes; 
px vercel deploy --prod --yes; validation builds/starts in the recovered source tree; 
pm run db:setup attempt.
- Rollback steps:
  1. Re-deploy or re-alias the previous approved deployment https://drum-blonde-5ss2t9n2z-byoroofers-projects.vercel.app if the new production deploy needs to be backed out.
  2. Remove the local-only _recovered_5ss2_clean\src\.env.local copy if no longer needed for local validation.
  3. Remove the $timestamp entries from the .agent logs if this deploy record should be reverted.
- Rollback verification: Confirm production traffic no longer points to https://drum-blonde-7wsiv9f65-byoroofers-projects.vercel.app / https://drum-blonde.vercel.app for this rollout and that the .agent files no longer reference this deployment.

## 2026-04-01T15:19:48.1870648-05:00 | Switch recovered production to Google Photos Picker flow

- Timestamp: `2026-04-01T15:19:48.1870648-05:00`
- Change summary: Added picker-based Google Photos helper/routes/UI to the recovered production source and redeployed production to `https://drum-blonde-jxc5xdube-byoroofers-projects.vercel.app` / `https://drum-blonde.vercel.app`.
- Files changed: `_recovered_5ss2_clean/src/lib/env.js`, `_recovered_5ss2_clean/src/lib/google-photos-picker.js`, `_recovered_5ss2_clean/src/app/admin/google-photos-import-panel.jsx`, `_recovered_5ss2_clean/src/app/api/admin/google-photos/picker/session/route.js`, `_recovered_5ss2_clean/src/app/api/admin/google-photos/picker/session/[sessionId]/route.js`, `_recovered_5ss2_clean/src/app/api/admin/google-photos/picker/import/route.js`, `.agent/project_overview.md`, `.agent/architecture_notes.md`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: `cmd /c npm run build` in the recovered source; local `npm run start -- -p 3004` smoke checks; Google OAuth refresh + Picker `CreateSession` verification; `cmd /c npx vercel deploy --prod --yes`
- Rollback steps:
  1. Re-alias or redeploy `https://drum-blonde-7wsiv9f65-byoroofers-projects.vercel.app` if this picker rollout needs to be backed out.
  2. Delete `_recovered_5ss2_clean/src/lib/google-photos-picker.js` and `_recovered_5ss2_clean/src/app/api/admin/google-photos/picker/`.
  3. Restore `_recovered_5ss2_clean/src/app/admin/google-photos-import-panel.jsx` to the previous library-search implementation.
  4. Revert `_recovered_5ss2_clean/src/lib/env.js` if the client-id alias support should also be removed.
- Rollback verification: Confirm production no longer serves the picker-based admin Google Photos copy/routes, and confirm the alias no longer points to `https://drum-blonde-jxc5xdube-byoroofers-projects.vercel.app`.

## 2026-04-01T16:00:00-05:00 | Attempt remote Supabase schema apply from local machine

- Timestamp: $ts
- Change summary: Attempted to apply the recovered schema from this machine, but the direct DB host is IPv6-only here and the exact pooled-host tuple was not derivable from the available credentials.
- Files changed: .agent/work_log.md, .agent/rollback_log.md, .agent/open_issues.md, .agent/session_handoff.md
- Commands run: cmd /c npm run db:setup; Invoke-RestMethod DNS-over-HTTPS lookup; direct pg client connectivity probes to the DB IPv6 address and common Supabase pooler hosts.
- Rollback steps:
  1. Remove this entry and the corresponding notes in .agent/work_log.md, .agent/open_issues.md, and .agent/session_handoff.md after a successful schema apply.
  2. No code rollback is needed because no repo source files changed.
- Rollback verification: Confirm a later log entry records a successful schema apply and that the blocker note about the local machine's DB reachability has been removed or superseded.

## 2026-04-02T11:50:18.2642985-05:00 | Record verified Google Photos picker scope failure

- Timestamp: `2026-04-02T11:50:18.2642985-05:00`
- Change summary: Updated only the `.agent` memory files after reproducing the Google Photos picker failure directly against Google and confirming the stored credential lacks the required Picker scope.
- Files changed: `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: Investigation commands listed in `D:\Drum_Blonde\.agent\work_log.md`, including unrestricted Google OAuth refresh and Google Photos Picker `CreateSession` probes using the existing local credential set.
- Rollback steps:
  1. Remove the `2026-04-02T11:50:18.2642985-05:00` entries from `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, and `.agent/session_handoff.md` if this diagnosis is superseded.
  2. No application rollback is required because no site code, content, or environment values were changed.
- Rollback verification: Confirm the `.agent` files no longer mention the verified `ACCESS_TOKEN_SCOPE_INSUFFICIENT` reproduction from `2026-04-02` and confirm `git diff` shows no additional app-source edits from this task.

## 2026-04-02T12:30:13.7141961-05:00 | Rotate local Google Photos refresh token

- Timestamp: `2026-04-02T12:30:13.7141961-05:00`
- Change summary: Replaced local `GOOGLE_PHOTOS_REFRESH_TOKEN` in `.env.local` with a newly authorized token that matches the existing OAuth client and verified it can create a Google Photos Picker session.
- Files changed: `.env.local`, `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `.env.local` inspection commands; `apply_patch` on `.env.local`; unrestricted Google OAuth refresh + Google Photos Picker `CreateSession` verification.
- Rollback steps:
  1. Restore the previous `GOOGLE_PHOTOS_REFRESH_TOKEN` value in `.env.local`.
  2. Remove the `2026-04-02T12:30:13.7141961-05:00` entries from the `.agent` memory files if this credential update is reverted.
  3. Re-run the direct Google Photos Picker verification if you need to confirm the reverted token behavior.
- Rollback verification: Confirm `.env.local` contains the intended prior refresh token and confirm the newer success note is absent from the `.agent` files.

## 2026-04-02T12:40:37.9184643-05:00 | Create preview deployment for picker testing

- Timestamp: `2026-04-02T12:40:37.9184643-05:00`
- Change summary: Created a Vercel preview deployment from `D:\Drum_Blonde\_recovered_5ss2_clean\src` using build/runtime Google OAuth overrides so the picker can be tested without changing production.
- Files changed: `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `cmd /c npx vercel deploy --help`; unrestricted `cmd /c npx vercel deploy --yes --force --logs --target=preview ...`
- Rollback steps:
  1. No repo source rollback is needed because no application files changed for this deploy.
  2. If the preview is no longer needed, remove or ignore the preview deployment `https://drum-blonde-63h77szod-byoroofers-projects.vercel.app`.
  3. Remove the `2026-04-02T12:40:37.9184643-05:00` `.agent` entries if this preview-deploy record should be cleared.
- Rollback verification: Confirm production aliases still point to the prior production deployment and confirm the preview URL is no longer used for testing.

## 2026-04-02T12:59:38.3369115-05:00 | Redeploy preview with admin and Supabase envs

- Timestamp: `2026-04-02T12:59:38.3369115-05:00`
- Change summary: Created a newer Vercel preview deployment `https://drum-blonde-r2jccho4t-byoroofers-projects.vercel.app` from the recovered source with admin-login, Supabase, and Google OAuth env overrides for end-to-end dashboard testing.
- Files changed: `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: unrestricted `cmd /c npx vercel deploy ...` retries from `D:\Drum_Blonde\_recovered_5ss2_clean\src`
- Rollback steps:
  1. No repo source rollback is required because only deployment-time env overrides changed.
  2. Ignore or remove preview deployment `https://drum-blonde-r2jccho4t-byoroofers-projects.vercel.app` if it is no longer needed.
  3. Remove the `2026-04-02T12:59:38.3369115-05:00` `.agent` entries if this redeploy record should be cleared.
- Rollback verification: Confirm production aliases remain unchanged and confirm the newer preview URL is no longer being used for testing.

## 2026-04-02T13:37:22.8331636-05:00 | Add picker account/profile instructions

- Timestamp: `2026-04-02T13:37:22.8331636-05:00`
- Change summary: Added non-functional instructional copy to the root and recovered Google Photos picker panels explaining that the picker must be opened in the same signed-in Chrome profile as the target Google Photos account and that stale picker tabs should be avoided.
- Files changed: `components/google-photos-picker-panel.tsx`, `_recovered_5ss2_clean/src/app/admin/google-photos-import-panel.jsx`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: targeted source reads; `apply_patch`; `git diff -- _recovered_5ss2_clean\\src\\app\\admin\\google-photos-import-panel.jsx components\\google-photos-picker-panel.tsx`
- Rollback steps:
  1. Remove the added instructional copy from `components/google-photos-picker-panel.tsx`.
  2. Remove the added instructional copy from `_recovered_5ss2_clean/src/app/admin/google-photos-import-panel.jsx`.
  3. Remove the `2026-04-02T13:37:22.8331636-05:00` `.agent` entries if this documentation-only UI tweak is reverted.
- Rollback verification: Confirm both picker panels no longer mention browser-profile/account guidance or stale picker tabs.

## 2026-04-02T13:49:40.1617654-05:00 | Create public preview deployment

- Timestamp: `2026-04-02T13:49:40.1617654-05:00`
- Change summary: Created public preview deployment `https://drum-blonde-jnvhu4yw2-byoroofers-projects.vercel.app` from the recovered source with Google, admin, and Supabase env overrides so testing no longer requires Vercel auth.
- Files changed: `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: unrestricted `cmd /c npx vercel deploy --yes --force --logs --public ...`
- Rollback steps:
  1. No repo source rollback is required because only deployment-time settings changed.
  2. Ignore or remove the public preview deployment `https://drum-blonde-jnvhu4yw2-byoroofers-projects.vercel.app` if it is no longer needed.
  3. Remove the `2026-04-02T13:49:40.1617654-05:00` `.agent` entries if this deploy record should be cleared.
- Rollback verification: Confirm production aliases remain unchanged and confirm the public preview URL is no longer being used for testing.

## 2026-04-02T18:15:47.7763759-05:00 | Deploy recovered source to production

- Timestamp: `2026-04-02T18:15:47.7763759-05:00`
- Change summary: Deployed `D:\Drum_Blonde\_recovered_5ss2_clean\src` to Vercel production with Google, admin, and Supabase env overrides after confirming `drumblonde.tjware.me` resolves to Vercel's `76.76.21.21` A record.
- Files changed: `.agent/work_log.md`, `.agent/open_issues.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: unrestricted Vercel domain inspection; unrestricted DNS resolution check; unrestricted `cmd /c npx vercel deploy --prod --yes --force --logs ...`; unrestricted HTTPS/domain verification probes
- Rollback steps:
  1. Re-promote the prior approved deployment `https://drum-blonde-5ss2t9n2z-byoroofers-projects.vercel.app` or the immediately previous production deployment if this rollout must be backed out.
  2. Remove or supersede the `2026-04-02T18:15:47.7763759-05:00` `.agent` entries after rollback.
  3. If needed, redeploy the previous production source snapshot.
- Rollback verification: Confirm `https://drum-blonde.vercel.app` no longer points to `https://drum-blonde-fmq8kkybm-byoroofers-projects.vercel.app` and confirm the custom domain resolves to the intended restored deployment.

## 2026-04-02T19:00:18.7823535-05:00 | Attach drumblonde.tjware.me to project

- Timestamp: `2026-04-02T19:00:18.7823535-05:00`
- Change summary: Attached `drumblonde.tjware.me` to the linked `drum-blonde` Vercel project so the custom domain can point at the latest production deployment instead of returning `DEPLOYMENT_NOT_FOUND`.
- Files changed: `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: unrestricted Vercel project/domain inspection commands; unrestricted `cmd /c npx vercel domains add drumblonde.tjware.me`
- Rollback steps:
  1. Remove `drumblonde.tjware.me` from the `drum-blonde` project in Vercel if the binding must be undone.
  2. Remove or supersede the `2026-04-02T19:00:18.7823535-05:00` `.agent` entries after rollback.
- Rollback verification: Confirm `drumblonde.tjware.me` is no longer assigned to the `drum-blonde` project and that browser requests no longer route to its production deployment.

## 2026-04-03T00:00:00-05:00 | Homepage reconciliation + UI improvements

- Timestamp: `2026-04-03T00:00:00-05:00`
- Change summary: Replaced Phase 1 Blueprint homepage with recovered production source. Applied premium CSS improvements to globals.css. Added required app/components and lib/ dirs.
- Files changed: `app/page.js`, `app/layout.js`, `app/globals.css`, `app/components/*`, `lib/*`, `_recovered_5ss2_clean/src/app/globals.css`
- Commit: `aadfdde`
- Safety tag: `ui-improvement-baseline` points to `90d8fe1` (pre-change state)
- Rollback steps:
  1. `git revert aadfdde` — creates a clean reversal commit, or
  2. `git checkout ui-improvement-baseline -- app/page.js app/layout.js app/globals.css && git rm -r app/components lib/` then commit
  3. The original Phase 1 Blueprint page.js is in git history at `90d8fe1:app/page.js`
- Rollback verification: `npm run build` should pass; homepage should revert to the Blueprint (but Blueprint is disallowed for deploy)
