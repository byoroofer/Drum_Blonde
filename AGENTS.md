# AGENTS

## Purpose

- This repository hosts the Drum Blonde / Brooke creator distribution dashboard and site work.
- Persistent agent memory lives in `D:\Drum_Blonde\.agent`.
- Read this file and `D:\Drum_Blonde\.agent\session_handoff.md` before starting meaningful work.

## Required Workflow

- Treat the last known-good production deployment as the recovery source of truth when local git history and the live site disagree.
- Before pushing homepage or production-facing changes, verify the exact page content being shipped.
- If a rollback is needed, restore from the exact known-good deployment or exact known-good commit. Do not reconstruct from screenshots if a real deployment exists.
- Keep `AGENTS.md` updated whenever repository-level operating instructions change.

## Current Recovery Rule

- For the Drum Blonde site, if the local repo and the approved live site diverge, inspect Vercel deployment history first.
- The approved last known-good deployment is `https://drum-blonde-5ss2t9n2z-byoroofers-projects.vercel.app`.
- Treat `drum-blonde-5ss2t9n2z-byoroofers-projects.vercel.app` as the current recovery source of truth until explicitly replaced by the user.
- Do not build, deploy, promote, or push an alternative site as a recovery attempt when this deployment is the designated baseline.
- The recovered source tree for the approved deployment is `D:\Drum_Blonde\_recovered_5ss2_clean\src`.
- Until the main repo is reconciled, treat `D:\Drum_Blonde\_recovered_5ss2_clean\src` as the working code baseline for production fixes.
- Do not trust the current root repo tree as the source of truth for homepage or media state until it is replaced with the recovered `5ss2...` source.
- Before any future production deploy, verify the change against the recovered `5ss2...` source first.
- Do not publish the `Phase 1 Blueprint` homepage.

## Repo Organization

- `app/`: Next.js App Router pages, layouts, and API routes.
- `app/admin/`: operator dashboard UI and server actions.
- `components/`: shared UI components and admin panels.
- `core/`: env handling, repository/data access, publishing rules, auth helpers, demo data, and media helpers.
- `data/`: static site data.
- `db/schema.sql`: Postgres/Supabase schema.
- `scripts/`: local operation scripts for env validation, DB setup, and worker triggering.
- `public/`: static assets served by Next.js.
- `types/`: supplemental TypeScript declarations.
- `_recovered_5ss2_clean/src/`: approved recovered source snapshot for production reconciliation.
- `.agent/`: durable project memory, decisions, rollback notes, and session handoff.

## Run, Build, and Validation

- `npm install`: install dependencies.
- `npm run check:env`: validate required local env vars in `.env.local`.
- `npm run db:setup`: apply `db/schema.sql` to the configured database.
- `npm run dev`: run the Next.js dev server.
- `npm run build`: production build and the primary repo-defined verification step.
- `npm run start`: run the production server after a build.
- `npm run jobs:run`: call the protected worker endpoint with `WORKER_SHARED_SECRET`.
- There is no committed `npm test` or `npm run lint` script in the current root repo. If you add one, update this file and `D:\Drum_Blonde\.agent\project_overview.md`.
- When TypeScript-specific validation is needed, prefer `npx tsc --noEmit` in addition to `npm run build`.

## Conventions

- Follow the existing mixed JavaScript and TypeScript codebase. Match the surrounding file style unless there is a clear reason to refactor.
- Use the `@/*` import alias when it improves clarity.
- Keep publishing behavior honest. Unsupported or unverified direct-post flows must remain manual handoff instead of fake automation.
- Never store secrets, tokens, or production values in repository files, `.agent` memory, or commit messages.
- Treat `.env.local`, pulled env dumps, and browser/profile artifacts as sensitive operational files.
- For homepage or other production-facing changes, compare the root tree against `_recovered_5ss2_clean/src` before building or deploying.

## Durable Memory Files

- `D:\Drum_Blonde\.agent\project_overview.md`: stable project summary, external dependencies, and current constraints.
- `D:\Drum_Blonde\.agent\architecture_notes.md`: important control flow, boundaries, and coupling notes.
- `D:\Drum_Blonde\.agent\work_log.md`: append one entry per meaningful task.
- `D:\Drum_Blonde\.agent\decisions.md`: durable technical and operational decisions.
- `D:\Drum_Blonde\.agent\rollback_log.md`: changed files, reversal steps, and rollback validation.
- `D:\Drum_Blonde\.agent\open_issues.md`: unresolved bugs, risks, and follow-ups.
- `D:\Drum_Blonde\.agent\session_handoff.md`: current state, validations, blockers, and next steps.

## Memory Update Rules

- After every meaningful task, append a structured entry to `D:\Drum_Blonde\.agent\work_log.md`.
- If you changed files, commands, operational state, or deployment posture, update `D:\Drum_Blonde\.agent\rollback_log.md`.
- If you made or adopted a durable decision, update `D:\Drum_Blonde\.agent\decisions.md`.
- If you discovered unresolved work, risks, or blockers, update `D:\Drum_Blonde\.agent\open_issues.md`.
- If your understanding of the system changed materially, update `D:\Drum_Blonde\.agent\project_overview.md` and/or `D:\Drum_Blonde\.agent\architecture_notes.md`.
- At the end of each session, refresh `D:\Drum_Blonde\.agent\session_handoff.md`.
- Keep entries concise, searchable, and timestamped. Summarize noisy command output instead of pasting raw logs.

## Required Work Log Fields

- timestamp
- task
- context
- files changed
- commands run
- errors encountered
- fix or decision
- rationale
- rollback plan
- next steps

## Session Handoff Checklist

- State what changed and why.
- List files touched and validations run.
- Call out errors, open risks, and anything not verified.
- Note rollback steps for the latest task.
- Leave the next highest-value action clearly stated.
