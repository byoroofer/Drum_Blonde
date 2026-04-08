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

## 2026-04-05T19:18:32.8281029-05:00 | Add Twitch live page and admin live console

- Timestamp: `2026-04-05T19:18:32.8281029-05:00`
- Change summary: Added `data/liveConfig.js`, new `/live` and `/admin/live` routes, and a conditional homepage live banner in `app/page.js`. The live-mode toggle is temporary in-memory state only.
- Files changed: `app/page.js`, `app/live/page.js`, `app/admin/live/page.js`, `data/liveConfig.js`, `.agent/project_overview.md`, `.agent/architecture_notes.md`, `.agent/work_log.md`, `.agent/decisions.md`, `.agent/rollback_log.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: Targeted source reads; `apply_patch`; `cmd /c npm run build`
- Rollback steps:
  1. Delete `app/live/page.js`.
  2. Delete `app/admin/live/page.js`.
  3. Delete `data/liveConfig.js`.
  4. Remove the `getLiveConfig` import and conditional live-strip block from `app/page.js`.
  5. Re-run `cmd /c npm run build` to confirm the site returns to the pre-live-feature state.
  6. Remove or supersede this timestamped entry from the `.agent` files if the feature is backed out.
- Rollback verification: Confirm `/live` and `/admin/live` return 404 locally, confirm the homepage no longer renders the live strip, and confirm `npm run build` passes cleanly.

## 2026-04-06T08:18:00.5444898-05:00 | Gate homepage media by admin star and deploy main

- Timestamp: `2026-04-06T08:18:00.5444898-05:00`
- Change summary: Added a hard `featuredHome === true` gate to homepage media selection in the root media engine, mirrored the same rule in the recovered baseline copy, committed the live/homepage bundle as `4967ab8`, pushed `main`, and confirmed Vercel production deployment `https://drum-blonde-c0c1bl5hn-byoroofers-projects.vercel.app` reached `Ready`.
- Files changed: `lib/media-repo.js`, `_recovered_5ss2_clean/src/lib/media-repo.js`, `.agent/project_overview.md`, `.agent/architecture_notes.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `cmd /c npm run build`; `git add app/page.js app/live/page.js app/admin/live/page.js data/liveConfig.js lib/media-repo.js`; `git commit -m "Add live page and require featured media on homepage"`; `git push origin main`; `cmd /c npx vercel ls`
- Rollback steps:
  1. `git revert 4967ab8`
  2. `git push origin main`
  3. Confirm the next Vercel production deployment becomes the active ready deployment.
  4. If only the homepage filter needs to be reversed locally, remove the `featuredHome === true` checks from `buildHomepageSelection()` in `lib/media-repo.js`.
- Rollback verification: Confirm production no longer enforces featured-only homepage media, confirm the live homepage behavior matches the reverted commit set, and confirm Vercel shows the replacement deployment as `Ready`.

## 2026-04-06T09:05:00-05:00 | Add gallery page and quiet footer admin login

- Timestamp: `2026-04-06T09:05:00-05:00`
- Change summary: Added `app/gallery/page.js`, linked it from the homepage, removed the topbar admin-login CTA, replaced the footer admin login with a subdued text-style link, committed as `57cf145`, pushed `main`, and confirmed production deployment `https://drum-blonde-or6ms15an-byoroofers-projects.vercel.app` reached `Ready`.
- Files changed: `app/page.js`, `app/gallery/page.js`, `.agent/project_overview.md`, `.agent/architecture_notes.md`, `.agent/open_issues.md`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `npm run build`; `git add app/page.js app/gallery/page.js`; `git commit -m "Add gallery page and quiet admin login link"`; `git push origin main`; `npx vercel ls`
- Rollback steps:
  1. `git revert 57cf145`
  2. `git push origin main`
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Re-test the homepage header/footer and confirm `/gallery` no longer resolves.
- Rollback verification: Confirm the homepage topbar admin link is restored, confirm the separate gallery page is gone, and confirm Vercel shows the replacement deployment as `Ready`.

## 2026-04-06T11:06:34.5373348-05:00 | Reinstate root admin login enforcement

- Timestamp: `2026-04-06T11:06:34.5373348-05:00`
- Change summary: Restored real credential/session checks in `lib/admin-auth.js`, made `app/admin/login/page.js` render the login form again for signed-out users, updated `app/admin/actions.js` so successful sign-in redirects only to `/admin` paths, committed the repair as `7001fa4`, pushed `main`, and confirmed production deployment `https://drum-blonde-5bv2r4q5g-byoroofers-projects.vercel.app` reached `Ready`.
- Files changed: `lib/admin-auth.js`, `app/admin/login/page.js`, `app/admin/actions.js`, `.agent/architecture_notes.md`, `.agent/project_overview.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; `git diff -- lib/admin-auth.js app/admin/login/page.js app/admin/actions.js`; `git commit -m "Reinstate admin login enforcement"`; `git push origin main`; `cmd /c npx vercel ls`
- Rollback steps:
  1. `git revert 7001fa4`
  2. `git push origin main`
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Confirm `/admin` is back to the prior open-access behavior only if that rollback is intentionally desired.
- Rollback verification: Confirm the replacement deployment is `Ready`, confirm unauthenticated requests can once again load `/admin` directly only after the revert, and confirm the production build still passes.

## 2026-04-06T12:29:18.3610850-05:00 | Correct Vercel production admin credentials and redeploy

- Timestamp: `2026-04-06T12:29:18.3610850-05:00`
- Change summary: Diagnosed the live `invalid` login error as a Vercel Production env mismatch, replaced the broken `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in Vercel, redeployed the latest production deployment without using the dirty local workspace, confirmed `https://drum-blonde-qupk2oth0-byoroofers-projects.vercel.app` reached `Ready`, and removed the temporary pulled env file.
- Files changed: `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`, `.agent/open_issues.md`
- Commands run: local credential probes; `npx vercel env ls`; `npx vercel env pull`; `npx vercel env rm`; `npx vercel env add`; `npx vercel redeploy`; `npx vercel ls`; `Remove-Item -LiteralPath .env.vercel-prod`
- Rollback steps:
  1. Replace the current Production `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in Vercel with the previous values only if intentionally undoing the login repair.
  2. Redeploy production from the current live deployment.
  3. Wait for the replacement production deployment to reach `Ready`.
  4. Re-test `/admin` and confirm the login behavior matches the intentionally restored env values.
- Rollback verification: Confirm the replacement deployment is `Ready`, confirm the live login behavior matches the reverted env values, and confirm no temporary env dump file remains in the workspace.

## 2026-04-06T12:46:55.2249413-05:00 | Add admin video thumbnail fallback placeholder

- Timestamp: `2026-04-06T12:46:55.2249413-05:00`
- Change summary: Added a generated SVG fallback thumbnail for video assets in `lib/media-repo.js` and updated `app/api/admin/media/[id]/thumbnail/route.js` to return that placeholder image when poster generation is unavailable instead of returning a broken thumbnail response.
- Files changed: `lib/media-repo.js`, `app/api/admin/media/[id]/thumbnail/route.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Revert the fallback-thumbnail changes in `lib/media-repo.js` and `app/api/admin/media/[id]/thumbnail/route.js`.
  2. Run `cmd /c npx tsc --noEmit`.
  3. Reopen `/admin/media` and confirm videos no longer show the generated placeholder thumbnail.
- Rollback verification: Confirm video tiles in `/admin/media` fall back to the old broken/empty preview behavior only if that rollback is intentionally desired, and confirm no other media rendering changed.

## 2026-04-06T12:48:23.0821543-05:00 | Split admin dashboard from media library and refactor starred-video rotation

- Timestamp: `2026-04-06T12:48:23.0821543-05:00`
- Change summary: Added a persistent admin sidebar shell, moved the full media library/editor to `/admin/media`, restored the missing remote URL import route, added on-demand admin thumbnail backfill via `/api/admin/media/[id]/thumbnail`, cleaned up admin labels, and changed homepage selection so starred videos drive rotation with the highest-view starred video pinned first.
- Files changed: `app/admin/layout.js`, `components/admin-shell.tsx`, `app/admin/page.js`, `app/admin/media/page.js`, `app/admin/actions.js`, `app/admin/live/page.js`, `app/admin/upload-widget.jsx`, `app/admin/google-photos-import-panel.jsx`, `app/admin/remote-url-import-panel.jsx`, `app/api/admin/media/[id]/thumbnail/route.js`, `app/api/admin/import/remote-url/route.js`, `app/globals.css`, `app/page.js`, `lib/media-repo.js`, `.agent/project_overview.md`, `.agent/architecture_notes.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npx tsc --noEmit`; `cmd /c npm run build`
- Rollback steps:
  1. Remove `app/admin/layout.js`, `app/admin/media/page.js`, `app/api/admin/media/[id]/thumbnail/route.js`, and `app/api/admin/import/remote-url/route.js`.
  2. Restore the previous versions of `components/admin-shell.tsx`, `app/admin/page.js`, `app/admin/actions.js`, `app/admin/live/page.js`, `app/admin/upload-widget.jsx`, `app/admin/google-photos-import-panel.jsx`, `app/admin/remote-url-import-panel.jsx`, `app/globals.css`, `app/page.js`, and `lib/media-repo.js`.
  3. Run `cmd /c npx tsc --noEmit`.
  4. Run `cmd /c npm run build`.
  5. Browser-check `/admin`, `/admin/media`, and `/` to confirm the prior admin and homepage behavior is back.
- Rollback verification: Confirm the admin sidebar is gone, the media library is back inside `/admin`, the homepage no longer uses the new pinned-starred-video ordering, and both validation commands pass after the revert.

## 2026-04-06T13:39:26.7421278-05:00 | Real video frame thumbnails for admin media tiles

- Timestamp: `2026-04-06T13:39:26.7421278-05:00`
- Change summary: Added `app/components/media-thumbnail.jsx`, switched `app/admin/media/page.js` to use it for tile/detail previews, added minimal thumbnail-surface CSS in `app/globals.css`, and upgraded both `lib/media-repo.js` and `core/video.ts` to seek across several early video frames and avoid saving obviously dark/blank thumbnails.
- Files changed: `app/admin/media/page.js`, `app/components/media-thumbnail.jsx`, `app/globals.css`, `lib/media-repo.js`, `core/video.ts`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Delete `app/components/media-thumbnail.jsx`.
  2. Restore the previous versions of `app/admin/media/page.js`, `app/globals.css`, `lib/media-repo.js`, and `core/video.ts`.
  3. Run `cmd /c npm run build`.
  4. Run `cmd /c npx tsc --noEmit`.
  5. Reopen `/admin/media` and confirm missing video posters have returned to the prior placeholder-only behavior.
- Rollback verification: Confirm image tiles still behave exactly as before, confirm missing video tiles no longer show paused-frame previews, and confirm both validation commands pass after the revert.

## 2026-04-06T14:29:00.0000000-05:00 | Deploy thumbnail fix to production

- Timestamp: `2026-04-06T14:29:00.0000000-05:00`
- Change summary: Pushed commit `13bf20c6eeb6fe64af5256e084db0bddc76edb5d` to `origin/main` and confirmed Vercel production deployment `https://drum-blonde-b6r7wz73d-byoroofers-projects.vercel.app` reached `Ready`.
- Files changed: `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `git commit -m "Fix video thumbnails in admin media library"`; `git push origin main`; `cmd /c npx vercel ls`
- Rollback steps:
  1. Revert commit `13bf20c6eeb6fe64af5256e084db0bddc76edb5d`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `/admin/media` and confirm the live site is back on the prior behavior.
- Rollback verification: Confirm the new deployment is no longer the active production build and confirm the live admin media library behavior matches the intentionally reverted state.

## 2026-04-06T15:39:51.9529305-05:00 | Explicit spotlight control and homepage clip ranges

- Timestamp: `2026-04-06T15:39:51.9529305-05:00`
- Change summary: Added a spotlight toggle to admin media-library tiles, added `app/admin/clip-range-editor.jsx` so video items can save start/end clip boundaries, updated `lib/media-repo.js` to treat `home_slot = 0` as the explicit spotlight marker and to read/write clip metadata through `processing_log`, updated homepage playback in `app/page.js` plus `app/components/trackable-video.jsx` to honor spotlight and clip ranges, and changed admin-library video tiles to autoplay via `TrackableVideo`.
- Files changed: `app/admin/actions.js`, `app/admin/clip-range-editor.jsx`, `app/admin/media/page.js`, `app/admin/page.js`, `app/components/trackable-video.jsx`, `app/globals.css`, `app/page.js`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npx tsc --noEmit`; `cmd /c npm run build`; `Remove-Item -LiteralPath 'D:\\Drum_Blonde\\.next' -Recurse -Force`; clean `cmd /c npm run build`
- Rollback steps:
  1. Delete `app/admin/clip-range-editor.jsx`.
  2. Restore the previous versions of `app/admin/actions.js`, `app/admin/media/page.js`, `app/admin/page.js`, `app/components/trackable-video.jsx`, `app/globals.css`, `app/page.js`, and `lib/media-repo.js`.
  3. Delete `D:\\Drum_Blonde\\.next`.
  4. Run `cmd /c npm run build`.
  5. Run `cmd /c npx tsc --noEmit`.
  6. Browser-check `/admin/media` and `/` to confirm spotlight/clip behavior is back to the prior automatic-only flow.
- Rollback verification: Confirm the spotlight icon is gone, clip sliders are gone, the homepage no longer honors saved clip ranges, and both validation commands pass after the revert.

## 2026-04-06T15:58:59.7574308-05:00 | Verified social handles and restyled homepage social buttons

- Timestamp: `2026-04-06T15:58:59.7574308-05:00`
- Change summary: Corrected the homepage YouTube handle to the verified `@Drum_Blonde` value, added a more explicit action pill to the social cards, and gave the public social buttons stronger platform-specific TikTok/Instagram/YouTube/Twitch branding in both the root tree and the recovered baseline mirror.
- Files changed: `data/siteData.js`, `app/page.js`, `app/globals.css`, `_recovered_5ss2_clean/src/data/siteData.js`, `_recovered_5ss2_clean/src/app/page.js`, `_recovered_5ss2_clean/src/app/globals.css`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npx tsc --noEmit`; `cmd /c npm run build`; direct raw social-profile metadata fetches with `curl.exe`/`Invoke-WebRequest`
- Rollback steps:
  1. Restore the previous versions of `data/siteData.js`, `app/page.js`, and `app/globals.css`.
  2. Restore the mirrored `_recovered_5ss2_clean/src/data/siteData.js`, `_recovered_5ss2_clean/src/app/page.js`, and `_recovered_5ss2_clean/src/app/globals.css` files.
  3. Run `cmd /c npm run build`.
  4. Browser-check `/` and confirm the social links and button surfaces match the intentionally restored prior state.
- Rollback verification: Confirm the homepage no longer shows `@Drum_Blonde` for YouTube, confirm the social cards have returned to their prior muted styling, and confirm the homepage build passes after the revert.

## 2026-04-06T18:30:59.1333719-05:00 | Deploy homepage social-button refresh to production

- Timestamp: `2026-04-06T18:30:59.1333719-05:00`
- Change summary: Committed the isolated homepage social-button refresh as `47eb752a1cbda54568d2349d7917857d7cdb3c40`, pushed it to `origin/main`, confirmed Vercel production deployment `https://drum-blonde-lyyc6gcw7-byoroofers-projects.vercel.app` reached `Ready`, and verified `https://drumblonde.tjware.me` returned `HTTP/1.1 200 OK`.
- Files changed: `app/page.js`, `app/globals.css`, `data/siteData.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `git commit -m "Refresh homepage social buttons"`; `git push origin main`; `cmd /c npx vercel ls`; `curl.exe -I https://drumblonde.tjware.me`
- Rollback steps:
  1. Revert commit `47eb752a1cbda54568d2349d7917857d7cdb3c40`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `https://drumblonde.tjware.me/` and confirm the homepage is back on the prior social-button state.
- Rollback verification: Confirm the new production deployment is no longer active, confirm the custom domain still returns `200 OK`, and confirm the homepage no longer shows the refreshed platform-specific social styling.

## 2026-04-06T20:53:15.1127573-05:00 | Homepage video wall to 3-up hero row and 6-tile reel grid

- Timestamp: `2026-04-06T20:53:15.1127573-05:00`
- Change summary: Reworked the public homepage video layout so the hero now shows a dedicated intro block, a three-column edge-to-edge featured video wall, and a centered six-tile reel library below; expanded the homepage video source pool to nine slots; and mirrored the same public-facing change into the recovered baseline files.
- Files changed: `app/page.js`, `app/globals.css`, `_recovered_5ss2_clean/src/app/page.js`, `_recovered_5ss2_clean/src/app/globals.css`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Restore the previous versions of `app/page.js` and `app/globals.css`.
  2. Restore the mirrored `_recovered_5ss2_clean/src/app/page.js` and `_recovered_5ss2_clean/src/app/globals.css` files.
  3. Run `cmd /c npm run build`.
  4. Run `cmd /c npx tsc --noEmit`.
  5. Browser-check `/` and confirm the old mixed stacked hero videos and two-card reel strip are restored.
- Rollback verification: Confirm the homepage no longer shows the three-across hero video wall or the six-tile reel library, and confirm both validation commands pass after the restore.

## 2026-04-06T21:40:49.4667437-05:00 | Deploy homepage video wall to production

- Timestamp: `2026-04-06T21:40:49.4667437-05:00`
- Change summary: Committed the isolated homepage video-wall refactor as `2ac2e389ea19c990951ad3486efbb156c04bc5c3`, pushed it to `origin/main`, confirmed Vercel production deployment `https://drum-blonde-1m2bfcrhj-byoroofers-projects.vercel.app` reached `Ready`, and verified `https://drumblonde.tjware.me/` returned `HTTP/1.1 200 OK`.
- Files changed: `app/page.js`, `app/globals.css`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `git commit -m "Rebuild homepage video wall"`; `git push origin main`; `cmd /c npx vercel ls`; escalated `cmd /c npx vercel ls`; `curl.exe -I https://drumblonde.tjware.me`
- Rollback steps:
  1. Revert commit `2ac2e389ea19c990951ad3486efbb156c04bc5c3`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `https://drumblonde.tjware.me/` and confirm the homepage no longer shows the three-across video wall and six-tile reel grid.
- Rollback verification: Confirm the new production deployment is no longer active, confirm the custom domain still returns `200 OK`, and confirm the homepage has returned to the prior video arrangement.

## 2026-04-06T21:49:43.7010960-05:00 | Local-only hero spotlight beside homepage headline

- Timestamp: `2026-04-06T21:49:43.7010960-05:00`
- Change summary: Refactored the homepage intro so a dedicated spotlight video now sits to the right of the hero copy, changed the remaining media split to `1 spotlight + 3 top-row videos + 6 reel-grid videos`, and mirrored the same structure into the recovered baseline files. This change is local only and has not been deployed yet.
- Files changed: `app/page.js`, `app/globals.css`, `_recovered_5ss2_clean/src/app/page.js`, `_recovered_5ss2_clean/src/app/globals.css`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; two runs of `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Restore the previous versions of `app/page.js` and `app/globals.css`.
  2. Restore the mirrored `_recovered_5ss2_clean/src/app/page.js` and `_recovered_5ss2_clean/src/app/globals.css` files.
  3. Run `cmd /c npm run build`.
  4. Run `cmd /c npx tsc --noEmit`.
  5. Browser-check `/` and confirm the hero no longer shows a dedicated spotlight card beside the headline.
- Rollback verification: Confirm the intro returns to a single text block, confirm the top row goes back to the prior three-up library-only arrangement, and confirm both validation commands pass after the restore.

## 2026-04-06T21:53:16.7725999-05:00 | Deploy homepage spotlight hero video to production

- Timestamp: `2026-04-06T21:53:16.7725999-05:00`
- Change summary: Committed the isolated homepage spotlight placement as `9c6d9f9076ad1c4e36de5ee8be9dc0b3baef2122`, pushed it to `origin/main`, confirmed Vercel production deployment `https://drum-blonde-bahatl4my-byoroofers-projects.vercel.app` reached `Ready`, and verified `https://drumblonde.tjware.me/` returned `HTTP/1.1 200 OK`.
- Files changed: `app/page.js`, `app/globals.css`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `git commit -m "Add homepage spotlight hero video"`; `git push origin main`; `cmd /c npx vercel ls`; escalated `cmd /c npx vercel ls`; `curl.exe -I https://drumblonde.tjware.me`
- Rollback steps:
  1. Revert commit `9c6d9f9076ad1c4e36de5ee8be9dc0b3baef2122`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `https://drumblonde.tjware.me/` and confirm the homepage no longer shows the spotlight video beside the hero text.
- Rollback verification: Confirm the new production deployment is no longer active, confirm the custom domain still returns `200 OK`, and confirm the homepage has returned to the prior no-spotlight hero layout.

## 2026-04-06T23:04:07.7156382-05:00 | Purge all non-starred media assets

- Timestamp: `2026-04-06T23:04:07.7156382-05:00`
- Change summary: Deleted every `media_assets` row where `featured_home !== true` and removed the associated storage objects from the Supabase media bucket. The purge removed `26` assets total: `19` videos and `7` images.
- Files changed: `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: inline Node/Supabase dry-run query; inline Node/Supabase storage+row deletion script; inline verification query
- Rollback steps:
  1. Restore the deleted `media_assets` rows from a database backup or point-in-time recovery snapshot if one exists.
  2. Restore the deleted storage objects for both original files and thumbnails from storage backup/version history if available.
  3. If no backups exist, re-upload the removed assets manually.
  4. Hard-refresh `/admin/media` and `/` to confirm the restored assets are visible again.
- Rollback verification: Confirm `media_assets` once again contains the previously removed non-starred rows, confirm their storage objects resolve, and confirm `/admin/media` shows more than the `10` remaining starred assets.

## 2026-04-07T01:03:29.0593115-05:00 | Saveable media editor in admin library

- Timestamp: `2026-04-07T01:03:29.0593115-05:00`
- Change summary: Added a real admin media editor that saves processed assets in place. Video saves now run through `ffmpeg` for trim/mute output, image saves now run through `sharp` for rotate/brightness/contrast/saturation, and the edit view in `/admin/media` now exposes this editor above the metadata form.
- Files changed: `app/admin/actions.js`, `app/admin/clip-range-editor.jsx`, `app/admin/media/page.js`, `app/admin/media-asset-editor.jsx`, `app/components/trackable-video.jsx`, `app/globals.css`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Remove `app/admin/media-asset-editor.jsx`.
  2. Restore the previous versions of `app/admin/actions.js`, `app/admin/clip-range-editor.jsx`, `app/admin/media/page.js`, `app/components/trackable-video.jsx`, `app/globals.css`, and `lib/media-repo.js`.
  3. Run `cmd /c npm run build`.
  4. Run `cmd /c npx tsc --noEmit`.
  5. Browser-check `/admin/media` and confirm the editor panel is gone and the page has returned to metadata-only editing.
- Rollback verification: Confirm `/admin/media` no longer shows the saveable asset editor, confirm edited-save actions are unavailable, and confirm both validation commands pass after the restore.

## 2026-04-07T01:12:01.4196675-05:00 | Per-video rank controls in admin media library

- Timestamp: `2026-04-07T01:12:01.4196675-05:00`
- Change summary: Added a compact `Rank` box to each video tile in `/admin/media` with a `1..10` step selector and up/down arrow buttons, plus a silent server action that adjusts `manual_rank` in-place. Manual rank is now clamped to `-10..10` and applied directly in homepage priority sorting before smart-score tiebreaks.
- Files changed: `app/admin/actions.js`, `app/admin/media/page.js`, `app/globals.css`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npm run build`; two runs of `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Restore the previous versions of `app/admin/actions.js`, `app/admin/media/page.js`, `app/globals.css`, and `lib/media-repo.js`.
  2. Run `cmd /c npm run build`.
  3. Run `cmd /c npx tsc --noEmit`.
  4. Browser-check `/admin/media` and confirm the rank box is gone from video tiles and manual rank changes no longer happen from grid actions.
- Rollback verification: Confirm video tiles no longer show the `Rank` control, confirm the metadata form still loads normally, and confirm both validation commands pass after the restore.

## 2026-04-07T01:46:33.8401827-05:00 | Deploy admin media editor and rank controls to production

- Timestamp: `2026-04-07T01:46:33.8401827-05:00`
- Change summary: Committed the isolated admin media-library editor plus tile-rank controls as `d5688106aa3530f65d6ec1e0f3147577bb30354f`, pushed them to `origin/main`, confirmed Vercel production deployment `https://drum-blonde-pb78l3ay8-byoroofers-projects.vercel.app` reached `Ready`, and verified `https://drumblonde.tjware.me/` returned `HTTP/1.1 200 OK`.
- Files changed: `app/admin/actions.js`, `app/admin/clip-range-editor.jsx`, `app/admin/media-asset-editor.jsx`, `app/admin/media/page.js`, `app/components/trackable-video.jsx`, `app/globals.css`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `git commit -m "Add admin media editor controls"`; `git push origin main`; `cmd /c npx vercel ls`; escalated `cmd /c npx vercel ls`; escalated `cmd /c curl.exe -I --ssl-no-revoke https://drumblonde.tjware.me/`
- Rollback steps:
  1. Revert commit `d5688106aa3530f65d6ec1e0f3147577bb30354f`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `https://drumblonde.tjware.me/admin/media` and confirm the rank box and saveable asset editor are no longer present.
- Rollback verification: Confirm the new production deployment is no longer active, confirm the custom domain still returns `200 OK`, and confirm `/admin/media` has returned to the prior metadata-only editing flow without tile-level rank controls.

## 2026-04-07T17:40:09.0360666-05:00 | Spotlight pool selection and fallback ordering

- Timestamp: `2026-04-07T17:40:09.0360666-05:00`
- Change summary: Fixed spotlight selection so `/admin/media` now treats `spotlightHome` as a persistent pool membership flag instead of only reflecting the current spotlight leader. Homepage spotlight selection now ranks spotlight-marked videos by `manual_rank` first, then views, and falls back to the most-viewed starred video when no spotlight-marked videos exist.
- Files changed: `app/admin/media/page.js`, `app/admin/page.js`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: targeted source audits; `cmd /c npx tsc --noEmit`; `cmd /c npm run build`
- Rollback steps:
  1. Restore the previous versions of `app/admin/media/page.js`, `app/admin/page.js`, and `lib/media-repo.js`.
  2. Run `cmd /c npx tsc --noEmit`.
  3. Run `cmd /c npm run build`.
  4. Hard-refresh `/admin/media` and `/` and confirm spotlight behaves as single-leader-only again.
- Rollback verification: Confirm spotlight tile buttons only light for the current leader, confirm multiple videos cannot remain in the spotlight pool, and confirm both validation commands pass after the restore.

## 2026-04-07T21:38:28.9805133-05:00 | Thumbnail-only media-library video tiles

- Timestamp: `2026-04-07T21:38:28.9805133-05:00`
- Change summary: Removed inline autoplay from `/admin/media` grid video tiles and switched the grid preview path to thumbnail-only rendering through `MediaThumbnail`.
- Files changed: `app/admin/media/page.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`
- Commands run: `cmd /c npx tsc --noEmit`; `cmd /c npm run build`
- Rollback steps:
  1. Restore the previous version of `app/admin/media/page.js`.
  2. Run `cmd /c npx tsc --noEmit`.
  3. Run `cmd /c npm run build`.
  4. Hard-refresh `/admin/media` and confirm video tiles autoplay inline again.
- Rollback verification: Confirm video tiles no longer use thumbnail-only rendering after restore and confirm both validation commands pass.

## 2026-04-07T23:49:02.8400930-05:00 | Homepage-features tile grid and five-minute rotation

- Timestamp: `2026-04-07T23:49:02.8400930-05:00`
- Change summary: Replaced the admin homepage-features stack with a 3-column touching tile grid that uses thumbnail previews, spotlight markers, and rotation numbers. Added deterministic five-minute rotation to homepage video ordering and changed unstar behavior so it also clears non-explicit spotlight selection.
- Files changed: `app/admin/page.js`, `app/globals.css`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`
- Commands run: `cmd /c npx tsc --noEmit`; `cmd /c npm run build`
- Rollback steps:
  1. Restore the previous versions of `app/admin/page.js`, `app/globals.css`, and `lib/media-repo.js`.
  2. Run `cmd /c npx tsc --noEmit`.
  3. Run `cmd /c npm run build`.
  4. Hard-refresh `/admin` and `/` and confirm the old stacked homepage-features list returns and five-minute rotation stops.
- Rollback verification: Confirm the tile grid no longer appears in `/admin`, confirm starred/spotlight ordering returns to the prior non-rotating behavior, and confirm both validation commands pass.

## 2026-04-08T00:43:56.0000000-05:00 | Deploy homepage rotation control updates to production

- Timestamp: `2026-04-08T00:43:56.0000000-05:00`
- Change summary: Committed the isolated homepage/admin control updates as `0a0d55472320a0b4894b8e865aa88b18ff759b47`, pushed them to `origin/main`, confirmed Vercel production deployment `https://drum-blonde-fc3hvt9g1-byoroofers-projects.vercel.app` reached `Ready`, and verified `https://drumblonde.tjware.me/` returned `HTTP/1.1 200 OK`.
- Files changed: `app/admin/media/page.js`, `app/admin/page.js`, `app/globals.css`, `lib/media-repo.js`, `.agent/work_log.md`, `.agent/rollback_log.md`, `.agent/session_handoff.md`, `.agent/decisions.md`, `.agent/open_issues.md`
- Commands run: `git commit -m "Refine homepage video rotation controls"`; `git push origin main`; `cmd /c npx vercel ls`; escalated `cmd /c npx vercel ls`; escalated `curl.exe -I --ssl-no-revoke https://drumblonde.tjware.me/`
- Rollback steps:
  1. Revert commit `0a0d55472320a0b4894b8e865aa88b18ff759b47`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `https://drumblonde.tjware.me/admin` and `https://drumblonde.tjware.me/admin/media` and confirm the new tile grid, spotlight-pool behavior, and thumbnail-only media-library tiles are gone.
- Rollback verification: Confirm the new production deployment is no longer active, confirm the custom domain still returns `200 OK`, and confirm the live admin homepage-features section and media library have returned to the prior behavior.

## 2026-04-08T02:15:44.0075055-05:00 | Route-backed derived-asset media editors

- Timestamp: `2026-04-08T02:15:44.0075055-05:00`
- Change summary: Added `/admin/media/edit/[id]` plus admin-only source/edit API routes, replaced the old inline asset-save editor with dedicated Fabric/ffmpeg.wasm editors, rewired `/admin/media` tile `Edit` links to the route editor, and changed edit persistence to create derived media assets instead of overwriting originals.
- Files changed: `package.json`, `package-lock.json`, `app/admin/media/page.js`, `app/admin/media/edit/[id]/page.js`, `app/admin/media/edit/[id]/loading.js`, `app/admin/media-asset-editor.jsx`, `app/admin/media-editor-shell.jsx`, `app/admin/image-media-editor.jsx`, `app/admin/video-media-editor.jsx`, `app/api/admin/media/[id]/source/route.js`, `app/api/admin/media/[id]/edits/route.js`, `app/globals.css`, `lib/media-repo.js`, `.agent/decisions.md`, `.agent/open_issues.md`, `.agent/session_handoff.md`, `.agent/work_log.md`
- Commands run: `cmd /c npm install fabric @ffmpeg/ffmpeg @ffmpeg/util`; escalated rerun of the same install; `cmd /c npm run build`; `cmd /c npx tsc --noEmit`
- Rollback steps:
  1. Restore the previous versions of `package.json`, `package-lock.json`, `app/admin/media/page.js`, `app/admin/media-asset-editor.jsx`, `app/globals.css`, and `lib/media-repo.js`.
  2. Remove `app/admin/media/edit/[id]/page.js`, `app/admin/media/edit/[id]/loading.js`, `app/admin/media-editor-shell.jsx`, `app/admin/image-media-editor.jsx`, `app/admin/video-media-editor.jsx`, `app/api/admin/media/[id]/source/route.js`, and `app/api/admin/media/[id]/edits/route.js`.
  3. Run `cmd /c npm run build`.
  4. Run `cmd /c npx tsc --noEmit`.
  5. Browser-check `/admin/media` and `/admin/media/edit/[id]` to confirm tile `Edit` returns to the old inline flow and no derived-save route remains.
- Rollback verification: Confirm `/admin/media` tile `Edit` no longer opens the dedicated route, confirm edited saves are no longer non-destructive derived assets, and confirm both validation commands pass after the restore.

## 2026-04-08T02:44:34.9935107-05:00 | Deploy route-backed media editors to production

- Timestamp: `2026-04-08T02:44:34.9935107-05:00`
- Change summary: Committed the route-backed admin media editor stack and non-destructive derived-asset save flow as `5103d7b9dea4f58b03ea848e42d7f1b898dab5b8`, pushed it to `origin/main`, confirmed production deployment `https://drum-blonde-njbko5xqa-byoroofers-projects.vercel.app` reached `Ready`, and verified `https://drumblonde.tjware.me/` returned `HTTP/1.1 200 OK`.
- Files changed: `.agent/rollback_log.md`, `.agent/session_handoff.md`, `.agent/work_log.md`
- Commands run: `git commit -m "Add route-backed media editors"`; `git push origin main`; `cmd /c npx vercel ls`; escalated delayed rerun of `Start-Sleep -Seconds 20; cmd /c npx vercel ls`; `curl.exe -I --ssl-no-revoke https://drumblonde.tjware.me/`
- Rollback steps:
  1. Revert commit `5103d7b9dea4f58b03ea848e42d7f1b898dab5b8`.
  2. Push the revert to `origin/main`.
  3. Wait for the replacement Vercel production deployment to reach `Ready`.
  4. Reopen `https://drumblonde.tjware.me/admin/media` and a direct `/admin/media/edit/[id]` URL and confirm the dedicated editor route and derived-asset save flow are gone.
- Rollback verification: Confirm the new production deployment is no longer active, confirm the custom domain still returns `200 OK`, and confirm `/admin/media` tile `Edit` has returned to the prior inline-only flow.
