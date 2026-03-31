# Repo Memory

## Current architecture notes

- Next.js App Router app with a public landing page and a protected admin dashboard.
- Runtime env loading is centralized in `core/env.ts`.
- Deployment/runtime env validation runs through `scripts/check-env.mjs`.
- Media ingest and publishing workflow orchestration live in `core/repository.ts`.
- Google Photos picker integration is handled by:
  - `core/google-photos-picker.ts`
  - `core/google-photos-auth.ts`
  - `app/api/google-photos/**`
  - `components/google-photos-picker-panel.tsx`
- AI-enhanced workflow generation is handled by `core/openai-workflows.ts` and is used opportunistically during ingest.

## Important env vars used by the app

### Core required env vars

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` or `SUPABASE_MEDIA_BUCKET`
- `DATABASE_URL`
- `TOKEN_ENCRYPTION_KEY`
- `WORKER_SHARED_SECRET`

### Optional integration env vars

- `GOOGLE_CLIENT_ID` or `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` or `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_PHOTOS_REFRESH_TOKEN` or `GOOGLE_PHOTOS_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

### Other optional platform env vars

- `META_APP_ID`
- `META_APP_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `PINTEREST_APP_ID`
- `PINTEREST_APP_SECRET`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

## What each major integration depends on

### Supabase

- Requires the core Supabase env vars and database/storage setup.
- Missing Supabase envs send the dashboard into demo mode instead of crashing the app.

### Google Photos picker

- Requires Google OAuth client env vars to support the admin browser connection flow.
- Can also use `GOOGLE_PHOTOS_REFRESH_TOKEN` or `GOOGLE_PHOTOS_ACCESS_TOKEN` for env-backed access.
- Missing Google Photos envs should only disable the Google Photos picker flow, not unrelated pages.

### Smart import / AI workflow generation

- Requires `OPENAI_API_KEY`.
- Missing `OPENAI_API_KEY` should only disable AI-enhanced caption/review generation.
- Manual ingest still uses the built-in caption blueprint fallback.

## Decisions made

- Treat Google Photos as an optional admin-only integration with graceful degradation.
- Treat OpenAI smart import as optional and fall back to the built-in caption blueprint when unavailable.
- Keep environment validation strict for core runtime requirements only.
- Keep UI changes minimal and scoped to the admin surfaces where the optional integrations are used.

## Known risks

- Google Photos picker still requires correct OAuth scope (`photospicker.mediaitems.readonly`) and valid Google credentials to function.
- `scripts/check-env.mjs` is aligned with runtime expectations, but it is still a separate script and must stay in sync with `core/env.ts`.
- Google Photos session credentials stored in cookies still depend on token protection via `TOKEN_ENCRYPTION_KEY` or `ADMIN_SESSION_SECRET`.

## Unresolved issues

- Custom domain / production domain configuration remains external to the repo and must be managed in Vercel/DNS.
- Optional platform connectors beyond Google Photos and OpenAI remain documented as future work and are not fully wired.
