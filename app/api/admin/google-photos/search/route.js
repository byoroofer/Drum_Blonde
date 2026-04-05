import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getGooglePhotosSetupStatus } from "@/lib/env";
import { listGooglePhotosVideoCandidates } from "@/lib/google-photos-import";
import { isTrustedOriginRequest } from "@/lib/security";

function buildErrorPayload(step, error) {
  return {
    ok: false,
    step,
    message: error instanceof Error ? error.message : String(error || "Google Photos request failed."),
    raw: error instanceof Error ? { name: error.name, stack: error.stack || "" } : error
  };
}

export const runtime = "nodejs";

export async function POST(request) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return NextResponse.json(buildErrorPayload("origin", new Error("Forbidden origin.")), { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json(buildErrorPayload("auth", new Error("Unauthorized.")), { status: 401 });
  }

  const googleStatus = getGooglePhotosSetupStatus();
  if (!googleStatus.ready) {
    return NextResponse.json(buildErrorPayload("config", new Error(`Missing configuration: ${googleStatus.missingRequired.join(", ")}`)), { status: 500 });
  }

  try {
    const payload = await request.json();
    const result = await listGooglePhotosVideoCandidates({
      albumId: String(payload.albumId || "").trim(),
      filenameQuery: String(payload.query || "").trim(),
      maxItems: Number(payload.maxItems || 6)
    });

    return NextResponse.json({
      ok: true,
      candidates: result.candidates,
      diagnostics: result.diagnostics
    });
  } catch (error) {
    const step = error?.stage || error?.step || "search";
    return NextResponse.json(buildErrorPayload(step, error), { status: 500 });
  }
}

