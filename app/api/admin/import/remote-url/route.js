import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getStorageSetupStatus } from "@/lib/env";
import { importRemoteMedia } from "@/lib/media-repo";
import { isTrustedOriginRequest } from "@/lib/security";

function buildErrorPayload(step, error) {
  return {
    ok: false,
    step,
    message: error instanceof Error ? error.message : String(error || "Import failed."),
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

  const storageStatus = getStorageSetupStatus();
  if (!storageStatus.ready) {
    return NextResponse.json(buildErrorPayload("config", new Error(`Missing configuration: ${storageStatus.missing.join(", ")}`)), { status: 500 });
  }

  try {
    const payload = await request.json();
    const remoteUrl = String(payload.remoteUrl || "").trim();

    if (!remoteUrl) {
      return NextResponse.json(buildErrorPayload("remote_fetch", new Error("remoteUrl is required.")), { status: 400 });
    }

    const asset = await importRemoteMedia({
      remoteUrl,
      source: String(payload.source || "remote_url").trim() || "remote_url",
      title: String(payload.title || "").trim(),
      description: String(payload.description || "").trim(),
      tags: String(payload.tags || "").trim(),
      featuredHome: payload.featuredHome === true,
      homeSlot: String(payload.homeSlot || "").trim() || null,
      manualRank: String(payload.manualRank || "0").trim(),
      workflowStatus: String(payload.workflowStatus || "approved").trim(),
      active: payload.active !== false
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const step = error?.step || "import";
    return NextResponse.json(buildErrorPayload(step, error), { status: 500 });
  }
}
