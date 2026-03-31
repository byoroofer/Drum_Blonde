# Change Log

## 2026-03-31T07:55:03.9139273-05:00

- Files changed:
  - `core/env.ts`
  - `core/google-photos-picker.ts`
  - `core/openai-workflows.ts`
  - `components/google-photos-picker-panel.tsx`
  - `app/admin/page.js`
  - `app/api/google-photos/picker/import/route.ts`
  - `app/api/google-photos/picker/session/[sessionId]/route.ts`
  - `scripts/check-env.mjs`
  - `.env.example`
  - `README.md`
  - `docs/repo-memory.md`
  - `docs/change-log.md`
- Reason for change:
  - Repair optional Google Photos and OpenAI integration warnings without breaking the rest of the app.
  - Centralize integration availability flags and make Google Photos admin flows fail gracefully instead of surfacing unrelated breakage.
- Exact behavior changed:
  - Added centralized integration availability flags in runtime env handling.
  - Kept Google Photos import optional and limited failures to the Google Photos admin feature surfaces.
  - Added route preflight checks so Google Photos session/import endpoints return a clear non-breaking `503` when the integration is unavailable.
  - Added a small admin warning that AI-enhanced smart import is disabled when `OPENAI_API_KEY` is missing while keeping manual ingest working.
  - Updated env docs and README to distinguish required core env vars from optional integrations.
- Rollback notes:
  - Revert the files above to the prior revision if the softer warnings or integration preflight checks need to be removed.
  - No secret values were added to tracked files in this change.
