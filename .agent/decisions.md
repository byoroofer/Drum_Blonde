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
