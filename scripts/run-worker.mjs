import { readFile } from "node:fs/promises";
import path from "node:path";

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

async function loadEnv() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    const parsed = parseEnv(raw);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function main() {
  await loadEnv();
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const secret = String(process.env.WORKER_SHARED_SECRET || "").trim();
  if (!secret) throw new Error("WORKER_SHARED_SECRET is required.");

  const response = await fetch(`${appUrl}/api/jobs/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": secret
    },
    body: JSON.stringify({ limit: 10 })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Worker request failed.");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

