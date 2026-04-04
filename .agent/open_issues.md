# Open Issues

Track unresolved bugs, risks, and follow-ups. Close or update entries when the state changes.

## ISSUE-2026-04-01-001 | Root homepage diverges from approved production baseline

- Status: Open
- Severity: High
- Context: Root `app/page.js` is the disallowed `Phase 1 Blueprint` homepage, while the approved production recovery baseline lives at `D:\Drum_Blonde\_recovered_5ss2_clean\src`.
- Risk: A careless build or deploy from the root tree could ship the wrong homepage.
- Next action: Reconcile homepage and production-facing state against the recovered baseline before any future deploys from the root tree.

## ISSUE-2026-04-01-002 | No dedicated test or lint script in the root repo

- Status: Open
- Severity: Medium
- Context: Root `package.json` exposes `dev`, `check:env`, `db:setup`, `build`, `start`, and `jobs:run`, but no `test` or `lint`.
- Risk: Validation is inconsistent and currently depends on build-only or ad hoc checks.
- Next action: Add an agreed validation script set and document it in `AGENTS.md` and `project_overview.md`.

## ISSUE-2026-04-01-003 | Existing unrelated local changes are present in the working tree

- Status: Open
- Severity: Medium
- Context: `git status --short` showed pre-existing changes in `.env.example`, `components/google-photos-picker-panel.tsx`, `core/env.ts`, `core/google-photos-picker.ts`, `scripts/check-env.mjs`, plus untracked `_recovered_5ss2_clean/`.
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

## ISSUE-2026-04-01-001 | UPDATE 2026-04-03

- Status: **Resolved** — root `app/page.js` now contains the recovered production homepage. Phase 1 Blueprint has been replaced.

## ISSUE-2026-04-03-001 | Root tree not yet deployed to production

- Status: Open
- Severity: Medium
- Context: The improved root tree builds clean locally (commit `aadfdde`) but has not yet been pushed to Vercel production. The live `drumblonde.tjware.me` still reflects the last deployed recovered-source build.
- Risk: Improvements are local-only until deployed.
- Next action: Push commit `aadfdde` to origin main → Vercel will auto-deploy. Then verify drumblonde.tjware.me renders correctly.
