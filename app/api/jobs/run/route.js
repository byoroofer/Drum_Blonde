import { NextResponse } from "next/server";
import { env } from "@/core/env";
import { runQueuedJobs } from "@/core/repository";

export async function POST(request) {
  const secret = request.headers.get("x-worker-secret") || "";
  if (!env.workerSharedSecret || secret !== env.workerSharedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Number(body?.limit || 10);
  const result = await runQueuedJobs(Number.isFinite(limit) ? limit : 10);
  return NextResponse.json(result, { status: 200 });
}

