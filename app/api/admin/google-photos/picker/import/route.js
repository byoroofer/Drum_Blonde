import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getGooglePhotosSetupStatus, getStorageSetupStatus } from "@/lib/env";
import { importGooglePhotosSelection, importGooglePhotosSelectionWithToken } from "@/lib/google-photos-picker";
import { isTrustedOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const googleStatus = getGooglePhotosSetupStatus();
  if (!googleStatus.ready) {
    return NextResponse.json(
      { error: `Missing Google Photos configuration: ${googleStatus.missingRequired.join(", ")}` },
      { status: 500 }
    );
  }

  const storageStatus = getStorageSetupStatus();
  if (!storageStatus.ready) {
    return NextResponse.json(
      { error: `Missing storage configuration: ${storageStatus.missing.join(", ")}` },
      { status: 500 }
    );
  }

  const pickerToken = String(request.headers.get("x-picker-token") || "").trim();
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Session id is required." }, { status: 400 });
  }

  const importFn = pickerToken ? importGooglePhotosSelectionWithToken : importGooglePhotosSelection;

  try {
    const result = await importFn({
      ...(pickerToken ? { accessToken: pickerToken } : {}),
      sessionId,
      selectedIds: Array.isArray(body.selectedIds) ? body.selectedIds : [],
      titlePrefix: String(body.titlePrefix || "").trim(),
      description: String(body.description || "").trim(),
      tags: String(body.tags || "google-photos, drumbrooke").trim(),
      manualRank: body.manualRank,
      homeSlot: String(body.homeSlot || "").trim() || null,
      featuredHome: body.featuredHome === true,
      workflowStatus: String(body.workflowStatus || "approved").trim()
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import picked Google Photos media." },
      { status: 500 }
    );
  }
}
