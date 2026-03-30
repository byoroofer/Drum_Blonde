# Brooke Creator Distribution System

A Next.js + TypeScript admin app for Brooke's creator workflow:

- ingest once into a source-of-truth media library
- generate platform-ready caption packages
- queue official publishing where supported later
- fall back to manual handoff where direct posting should not be faked
- log approvals, publish attempts, duplicates, and failures

## Local development

```bash
npm install
copy .env.example .env.local
npm run check:env
npm run db:setup
npm run dev
```

Open `http://localhost:3000`.

If Supabase env vars are missing, the app runs in a read-only demo mode so the dashboard still renders.

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth, Postgres, and Storage
- Protected worker endpoint for queued jobs
- `ffprobe-static` + `ffmpeg-static` for media inspection and thumbnail generation

## Key paths

- `app/admin` dashboard pages
- `app/admin/actions.js` server actions
- `app/api/jobs/run/route.js` worker trigger
- `core/repository.ts` core data/service layer
- `core/publishing.ts` adapter execution rules
- `db/schema.sql` database schema

## Deployment

1. Create a Supabase project.
2. Apply `db/schema.sql`.
3. Create at least one Supabase Auth user for operators.
4. Add that user's `auth.users.id` into `creator_memberships` with an admin role.
5. Set production env vars from `.env.example`.
6. Deploy to Vercel.
7. Protect the worker with `WORKER_SHARED_SECRET`.
8. Run the worker from a cron or a secure job runner by calling `POST /api/jobs/run`.

## Publishing stance

This build is deliberately conservative:

- it prepares official-API connector lanes
- it does not pretend unsupported publishing exists
- it defaults to manual handoff until OAuth/account linking is fully configured
- it keeps Twitch as a source lane and Reddit as a human-review lane

