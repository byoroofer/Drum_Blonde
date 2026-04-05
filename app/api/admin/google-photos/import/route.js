import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getGooglePhotosSetupStatus, getStorageSetupStatus } from "@/lib/env";
import { importGooglePhotosVideos } from "@/lib/google-photos-import";
import { isTrustedOriginRequest } from "@/lib/security";

function buildErrorPayload(step, error) {
  return {
    ok: false,
    step,
    message: error instanceof Error ? error.message : String(error || "Google Photos import failed."),
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
    return NextResponse.json(buildErrorPayload("config", new Error(`Missing Google Photos configuration: ${googleStatus.missingRequired.join(", ")}`)), { status: 500 });
  }

  const storageStatus = getStorageSetupStatus();
  if (!storageStatus.ready) {
    return NextResponse.json(buildErrorPayload("config", new Error(`Missing storage configuration: ${storageStatus.missing.join(", ")}`)), { status: 500 });
  }

  try {
    const payload = await request.json();
    const summary = await importGooglePhotosVideos({
      albumId: String(payload.albumId || "").trim(),
      filenameQuery: String(payload.query || "").trim(),
      maxItems: Number(payload.maxItems || 6),
      tags: String(payload.tags || "google-photos, drumbrooke").trim(),
      featuredHome: payload.featuredHome === true,
      manualRank: String(payload.manualRank || "0").trim(),
      homeSlot: String(payload.homeSlot || "").trim() || null,
      workflowStatus: String(payload.workflowStatus || "approved").trim()
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const step = error?.stage || error?.step || "import";
    return NextResponse.json(buildErrorPayload(step, error), { status: 500 });
  }
}

