export const ARCHITECTURE_LAYERS = [
  {
    title: "Next.js App Router",
    body: "Server-rendered admin workspace for intake, approvals, queue control, logs, and connector settings."
  },
  {
    title: "Supabase Core",
    body: "Supabase Auth for operators, Postgres for workflow state, and Storage for originals, thumbnails, and prepared variants."
  },
  {
    title: "Media Services",
    body: "Upload ingestion, checksum + duplicate checks, caption generation, version planning, and manual-review safeguards."
  },
  {
    title: "Publishing Layer",
    body: "Platform adapter registry that decides direct publish versus manual handoff based on official support and connected-account readiness."
  },
  {
    title: "Job Worker",
    body: "Protected worker endpoint that claims queued jobs, writes attempts, surfaces failures, and never silently drops work."
  }
];

export const FOLDER_BLUEPRINT = [
  "app/",
  "app/page.js",
  "app/admin/page.js",
  "app/admin/login/page.js",
  "app/admin/actions.js",
  "app/api/jobs/run/route.js",
  "components/admin-shell.tsx",
  "components/ui.tsx",
  "core/auth.ts",
  "core/blueprint.ts",
  "core/caption-engine.ts",
  "core/demo-data.ts",
  "core/env.ts",
  "core/platforms.ts",
  "core/publishing.ts",
  "core/repository.ts",
  "core/supabase.ts",
  "core/types.ts",
  "core/video.ts",
  "db/schema.sql",
  "tools/check-env.mjs",
  "tools/run-worker.mjs"
];

