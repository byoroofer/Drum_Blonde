import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim()];
      })
  );
}

async function main() {
  const envPath = path.join(root, ".env.local");
  const raw = await readFile(envPath, "utf8");
  const env = parseEnv(raw);
  const required = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "TOKEN_ENCRYPTION_KEY",
    "WORKER_SHARED_SECRET"
  ];

  const missing = required.filter((name) => !String(env[name] || "").trim());
  if (!String(env.SUPABASE_STORAGE_BUCKET || env.SUPABASE_MEDIA_BUCKET || "").trim()) {
    missing.push("SUPABASE_STORAGE_BUCKET or SUPABASE_MEDIA_BUCKET");
  }

  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const googlePhotosClientConfigured = Boolean(
    String(env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || "").trim() &&
    String(env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim()
  );
  const googlePhotosCredentialsConfigured = Boolean(
    String(env.GOOGLE_PHOTOS_REFRESH_TOKEN || env.GOOGLE_PHOTOS_ACCESS_TOKEN || "").trim()
  );
  const smartImportEnabled = Boolean(String(env.OPENAI_API_KEY || "").trim());

  console.log("Environment looks ready for Brooke's distribution dashboard.");
  if (!googlePhotosClientConfigured) {
    console.log("Optional Google Photos import: disabled until GOOGLE_CLIENT_ID/SECRET or GOOGLE_OAUTH_CLIENT_ID/SECRET are set.");
  } else if (!googlePhotosCredentialsConfigured) {
    console.log("Optional Google Photos import: OAuth-ready, but no env token is set. The admin can still connect Google Photos interactively.");
  } else {
    console.log("Optional Google Photos import: enabled through env-backed credentials.");
  }

  if (smartImportEnabled) {
    console.log(`Optional smart import: enabled with model ${String(env.OPENAI_MODEL || "gpt-5-mini").trim() || "gpt-5-mini"}.`);
  } else {
    console.log("Optional smart import: disabled until OPENAI_API_KEY is set. Manual ingest remains available.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
