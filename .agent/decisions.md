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
