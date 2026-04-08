# Decisions

Record durable technical and operational decisions here. Prefer one decision block per topic.

## Decision Template

- Date:
- Status:
- Decision:
- Context:
- Rationale:
- Consequence:
- Revisit when:

## 2026-04-01 | Active | Standardize persistent agent memory under `.agent/`

- Date: `2026-04-01`
- Status: Active
- Decision: Use the tracked `.agent/*.md` files as the single durable memory system for this repository.
- Context: The repo had a root `AGENTS.md` with recovery constraints but no structured cross-session memory, handoff, or rollback record.
- Rationale: A single searchable memory location is easier to maintain than ad hoc notes and prevents future sessions from losing operational context.
- Consequence: Every meaningful task must update the relevant `.agent` files instead of creating parallel note systems.
- Revisit when: The repository adopts a different approved memory format or the user requests a change.

## 2026-04-01 | Carried Forward | Recovered `5ss2...` deployment and source remain the production recovery truth

- Date: `2026-04-01`
- Status: Carried Forward
- Decision: Keep `https://drum-blonde-5ss2t9n2z-byoroofers-projects.vercel.app` and `D:\Drum_Blonde\_recovered_5ss2_clean\src` as the recovery source of truth for production-facing reconciliation.
- Context: This rule already existed in the repo-level `AGENTS.md` and governs homepage recovery and rollback safety.
- Rationale: Production recovery must come from a verified deployment/source snapshot, not from the current divergent root tree or screenshots.
- Consequence: Production-facing fixes and rollbacks must be checked against the recovered baseline before deploy activity.
- Revisit when: The user explicitly designates a different approved deployment or reconciles the main repo with the recovered tree.

## 2026-04-01 | Active | Keep `/admin/login` outside the authenticated admin layout

- Date: `2026-04-01`
- Status: Active
- Decision: Use an App Router route group for protected admin routes so `/admin/login` does not inherit the authenticated admin layout.
- Context: `app/admin/layout.js` called `requireDashboardUser()`, which wrapped `/admin/login` and caused a self-redirect loop.
- Rationale: The login page must remain reachable without an authenticated session, while `/admin` and the dashboard shell should still stay protected.
- Consequence: Protected admin pages belong under `app/admin/(protected)/`, while unauthenticated routes like `app/admin/login/page.js` stay outside that group.
- Revisit when: The admin auth flow is redesigned or the route structure changes substantially.

## 2026-04-01 | Active | Recovered production Google Photos integration should use Picker API, not Library API search

- Date: `2026-04-01`
- Status: Active
- Decision: The recovered production baseline should use Google Photos Picker session/import routes backed by `_recovered_5ss2_clean/src/lib/google-photos-picker.js` instead of the older Library API metadata search flow.
- Context: The recovered deploy's Library API path was already failing with scope errors, and the intended product behavior is user-selected Google Photos imports inside the admin portal.
- Rationale: Picker sessions match Google's supported selection flow and eliminate the brittle library-wide search dependency from the recovered admin UI.
- Consequence: Production Google Photos success now depends on a token minted with `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`; the old library-search routes are no longer the intended admin path.
- Revisit when: The recovered tree is reconciled with the main root repo or the Google Photos integration model changes again.

## 2026-04-05 | Active | Keep live-stream state temporary and isolated until persistence is explicitly requested

- Date: `2026-04-05`
- Status: Active
- Decision: The new live-stream feature should use `data/liveConfig.js` as a temporary in-memory control surface instead of modifying existing admin actions, media storage, or database-backed config.
- Context: The live feature request explicitly prohibited touching `media-repo.js`, existing admin actions, redirects, new dependencies, or Supabase-backed persistence for now.
- Rationale: A process-local toggle is the smallest safe implementation that fits the repo constraints and keeps the feature additive.
- Consequence: `isLiveOverride` can be flipped from `/admin/live`, but it resets on process restart, deploy, or cold start and should not be treated as durable operational state.
- Revisit when: The user asks for persistent live-state management, scheduling, or real stream-status automation.

## 2026-04-06 | Active | Homepage media exposure must be gated by the admin star

- Date: `2026-04-06`
- Status: Active
- Decision: Homepage media rotation must only consider assets with `featuredHome === true`; active status, hidden state, slot, and smart score apply only after that gate.
- Context: The homepage query was still allowing non-starred assets onto the live homepage whenever they were active, which made the admin star a soft ranking hint instead of the explicit homepage control the operator expects.
- Rationale: The star toggle in admin needs to be the single clear control for homepage eligibility.
- Consequence: Unstarred images and videos are now excluded from homepage rotation even if they are approved and active.
- Revisit when: The homepage curation model intentionally expands beyond the explicit star toggle.

## 2026-04-06 | Active | Root admin must use env-backed cookie auth until a deliberate migration replaces it

- Date: `2026-04-06`
- Status: Active
- Decision: Keep the current root-tree admin surface on `lib/admin-auth.js` with signed-cookie session checks and credential validation from `ADMIN_*` env vars; do not leave `/admin` or `/api/admin/*` in a permissive stub state.
- Context: The wired admin routes were using `lib/admin-auth.js`, but its guard functions had been replaced with unconditional `true` returns and `app/admin/login/page.js` was force-redirecting to `/admin`, which removed effective authentication from the live admin surface.
- Rationale: Restoring the existing auth model is safer and smaller than partially migrating the root tree to the separate `core/auth.ts` Supabase flow during an unrelated fix.
- Consequence: Unauthenticated access now goes back to `/admin/login`, admin API routes reject missing/invalid cookies, and future auth work must explicitly migrate routes if the Supabase-based system is meant to replace this path.
- Revisit when: The root admin routes are intentionally migrated off `lib/admin-auth.js` to a different approved auth system.

## 2026-04-06 | Active | Keep the admin dashboard and media library as separate routes under one persistent shell

- Date: `2026-04-06`
- Status: Active
- Decision: Use `app/admin/layout.js` plus `components/admin-shell.tsx` for a persistent sidebar, keep `/admin` focused on control-panel summaries/actions, and move the full media grid/editor to `/admin/media`.
- Context: The previous `/admin` page mixed uploads, filters, albums, diagnostics, and the entire media library/editor into one long monolith, which made navigation and future changes risky.
- Rationale: A dedicated media route is safer for high-volume browsing and makes the admin surface behave like a real control panel instead of a stacked landing page.
- Consequence: New admin links and action return targets should prefer `/admin/media` for library-specific work, while dashboard-only controls remain on `/admin`.
- Revisit when: The admin route map expands into additional dedicated pages or the user asks for a different IA.

## 2026-04-06 | Active | Starred videos are the homepage rotation pool, and the highest-view starred video stays pinned first

- Date: `2026-04-06`
- Status: Active
- Decision: `lib/media-repo.js` should treat all starred videos as homepage-rotation candidates and deterministically pin the highest-view starred video into the main spotlight slot before ordering the remaining starred videos.
- Context: The user wanted the admin star to control live homepage rotation and explicitly requested that the highest-view starred video remain in the lead spotlight position.
- Rationale: This keeps homepage behavior understandable to operators: star = eligible, highest views among starred = leader.
- Consequence: Non-starred videos no longer enter the homepage rotation path, and `app/page.js` must preserve the selection order coming from `getHomepageMedia()` instead of re-sorting it.
- Revisit when: The homepage curation model intentionally introduces manual spotlight overrides or a different ranking rule.

## 2026-04-06 | Active | Video thumbnails should use a hybrid preview-and-persist path

- Date: `2026-04-06`
- Status: Active
- Decision: For admin media tiles, keep durable server-generated JPEG thumbnails as the long-term source of truth, but when a video still lacks a stored poster, render a paused video frame client-side immediately and trigger the existing thumbnail backfill route so later loads use the cached image.
- Context: The previous placeholder-only fallback kept layout stable but did not let operators identify video content from the tile itself.
- Rationale: This is the smallest reliable path that fixes legacy rows without redesigning the library or depending on third-party transformation URLs.
- Consequence: Existing videos without posters become visually identifiable on first load, new/updated videos still store real thumbnails, and image behavior remains unchanged.
- Revisit when: The project adopts a dedicated background thumbnail job or persistent media-processing queue that can guarantee posters for every video before the library is opened.

## 2026-04-06 | Active | Use `home_slot = 0` for explicit spotlight and store clip ranges in processing logs

- Date: `2026-04-06`
- Status: Active
- Decision: Keep the live schema unchanged for now by using `home_slot = 0` as the explicit one-at-a-time spotlight marker and by persisting video clip start/end settings inside `processing_log` entries, then normalize those values back onto media items in `lib/media-repo.js`.
- Context: The user wanted the spotlight control restored and needed trimmed homepage clip ranges, but the current recovered media schema does not have dedicated spotlight or clip columns.
- Rationale: This avoids a blocking database migration while still making the admin workflow durable and deployable immediately.
- Consequence: Spotlight selection can be changed live with no schema push, clip ranges survive normal media edits, and a future schema migration can still replace these encodings cleanly if the project wants first-class columns later.
- Revisit when: The user asks for a formal DB migration or the media schema is intentionally extended with dedicated spotlight and clip-range fields.

## 2026-04-06 | Active | Homepage video walls should source nine slots and mirror the recovered baseline

- Date: `2026-04-06`
- Status: Active
- Decision: The public homepage hero should use a dedicated intro block plus a `3 + 6` video-wall layout, sourcing up to nine homepage clips from the ordered featured-home selection first and then filling from other eligible visible videos as needed; the same public-facing structure should be mirrored in `_recovered_5ss2_clean/src`.
- Context: The user explicitly asked for three large top videos and two rows of three smaller videos with edge-to-edge reel-library spacing, while repository instructions require homepage production fixes to stay aligned with the recovered baseline snapshot.
- Rationale: The prior hero layout mixed one left-side feature card with a stacked right column and only allocated six slots total, so it could not deliver the requested reel-library presentation.
- Consequence: Future homepage video changes should preserve the nine-slot pool and update both the root tree and recovered baseline counterparts unless the recovery workflow is replaced.
- Revisit when: The user asks for a different homepage media composition or the main repo is formally reconciled against a new recovery source of truth.

## 2026-04-06 | Active | Hero spotlight belongs beside the homepage headline, ahead of the video rows

- Date: `2026-04-06`
- Status: Active
- Decision: The homepage hero intro should reserve a dedicated spotlight video slot to the right of the main headline/copy block, with the remaining homepage media split below as `3` featured tiles plus `6` smaller reel tiles.
- Context: After approving the reel-library layout, the user explicitly requested a separate spotlight location next to the “She picked up the drums and didn’t look back.” text.
- Rationale: This gives the hero a single strongest video focal point without sacrificing the denser browsing grid underneath.
- Consequence: Homepage video selection now effectively needs ten slots (`1 + 3 + 6`) rather than nine, and future hero changes should preserve that dedicated spotlight position unless the user asks to move it.
- Revisit when: The user wants the spotlight merged back into the grid or wants a different hero composition.

## 2026-04-07 | Active | Media-library edits should rewrite the asset with a newly processed file

- Date: `2026-04-07`
- Status: Active
- Decision: The admin media-library editor should save real edited outputs back onto the existing asset row by downloading the current source, processing videos with `ffmpeg` and photos with `sharp`, uploading the edited file plus a fresh thumbnail, updating the row metadata, and deleting the previous stored file(s).
- Context: The user explicitly asked for a high-quality editor in the media library where videos and photos can be edited and saved, not just previewed or clipped for homepage playback.
- Rationale: A real editor needs to change the actual stored asset; metadata-only edits or client-side previews would not meet the request.
- Consequence: Editor saves are destructive to the previous stored version unless a storage/database backup exists, and browser-level verification is required before deploying because the save path now mutates live assets.
- Revisit when: The project adopts versioned media revisions, background edit jobs, or a separate non-destructive asset-history model.

## 2026-04-07 | Active | Homepage rotation rank should be operator-controlled in bounded `-10..10` steps

- Date: `2026-04-07`
- Status: Active
- Decision: Expose `manual_rank` as a quick per-video control in `/admin/media`, clamp the stored value to the bounded range `-10..10`, and apply it directly in homepage priority sorting before smart-score tiebreaking.
- Context: The user explicitly wanted every video tile in the media library to have a `Rank` box with up/down controls and selectable `1..10` step sizes that change the homepage rotation algorithm.
- Rationale: Operators need a fast, low-friction way to bias the homepage rotation from the grid without opening the full item editor or depending only on organic engagement signals.
- Consequence: Manual rank is now a stronger, explicit ordering signal for starred homepage videos, and all update paths should treat values outside `-10..10` as invalid/clamped.
- Revisit when: The project replaces manual weighting with a more formal recommendation model or introduces separate ranking controls for spotlight selection versus the general rotation pool.

## 2026-04-07 | Active | Spotlight selection should persist as multi-item pool membership, not a single `home_slot = 0` leader

- Date: `2026-04-07`
- Status: Active
- Decision: Treat homepage spotlight as a persistent multi-item selection pool derived from logged `spotlight_home` state, rank that pool by `manual_rank` before views, and only fall back to the most-viewed starred video when no spotlight selections exist.
- Context: The user explicitly asked for all spotlight-marked videos to participate in the homepage spotlight choice, reported that the current `/admin/media` spotlight button turned itself off on click, and wanted ranking numbers to take precedence inside spotlight ordering.
- Rationale: The old `home_slot = 0` encoding only supported one leader at a time, so the admin button reflected "current leader" rather than "selected for spotlight", which produced the visible deselect bug and prevented a real spotlight pool.
- Consequence: Spotlight state now depends on the latest logged manual-update fields as well as legacy `home_slot = 0` rows for backward compatibility, and future update paths must preserve `spotlight_home` in processing metadata unless a dedicated DB column replaces it.
- Revisit when: The media schema adds a first-class `spotlight_home` column or the user asks for timed/randomized rotation among spotlight selections instead of a single computed leader.

## 2026-04-07 | Active | Homepage video ordering should rotate on a five-minute cadence from ranked pools

- Date: `2026-04-07`
- Status: Active
- Decision: Rotate the already-ranked homepage video pools every five minutes, using the ranked spotlight-selection pool for the spotlight slot and the remaining ranked starred videos for the rest of the homepage positions.
- Context: The user explicitly asked for homepage videos to rotate every five minutes while keeping spotlight selections and manual rank precedence intact.
- Rationale: Rotating after ranking preserves operator intent while preventing the homepage from feeling permanently static.
- Consequence: The active homepage order now changes at five-minute time boundaries, so admin verification should account for time-bucket transitions when checking behavior.
- Revisit when: The user wants a different cadence, true randomness, or persistent per-visitor rotation state instead of shared time-bucket rotation.

## 2026-04-08 | Active | Admin media edits must create derived assets and open on a dedicated editor route

- Date: `2026-04-08`
- Status: Active
- Decision: `/admin/media` tile `Edit` actions should open a dedicated route-backed editor at `/admin/media/edit/[id]`, and all saved image/video edits must create new derived media assets instead of replacing the original stored file.
- Context: The user explicitly required direct-linkable full-screen editing, original preservation, and correct media-library refresh behavior for edited assets.
- Rationale: Route-backed editors support direct linking and cleaner state handling, while derived-asset saves remove the destructive overwrite risk from the prior editor flow.
- Consequence: Edited outputs now appear as new library items linked back to the source asset through logged metadata plus a best-effort `media_versions` record, and future editor/save paths must preserve that non-destructive model.
- Revisit when: The project adopts first-class revision tables/columns, background media jobs, or a more formal asset-version browser in the admin UI.
