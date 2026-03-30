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
    "SUPABASE_STORAGE_BUCKET",
    "DATABASE_URL",
    "TOKEN_ENCRYPTION_KEY",
    "WORKER_SHARED_SECRET"
  ];

  const missing = required.filter((name) => !String(env[name] || "").trim());
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const googlePhotosOptional = ["GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_PHOTOS_REFRESH_TOKEN or GOOGLE_PHOTOS_ACCESS_TOKEN"];
  console.log("Environment looks ready for Brooke's distribution dashboard.");
  console.log(`Optional Google Photos Picker envs: ${googlePhotosOptional.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

