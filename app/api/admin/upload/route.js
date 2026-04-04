import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getStorageSetupStatus } from "@/lib/env";
import { ingestUploadedMedia } from "@/lib/media-repo";
import { isTrustedOriginRequest } from "@/lib/security";

function buildErrorPayload(step, error) {
  return {
    ok: false,
    step,
    message: error instanceof Error ? error.message : String(error || "Upload failed."),
    raw: error instanceof Error ? { name: error.name, stack: error.stack || "" } : error
  };
}

export const runtime = "nodejs";

const MAX_FILES = 25;
const MAX_FILE_BYTES = 50 * 1024 * 1024 * 1024;   // 50 GB per file
const MAX_TOTAL_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB total batch

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
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value) => value instanceof File);

    if (!files.length) {
      return NextResponse.json(buildErrorPayload("validate_file", new Error("No files were uploaded.")), { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(buildErrorPayload("validate_file", new Error(`Maximum ${MAX_FILES} files per upload batch.`)), { status: 400 });
    }

    const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      return NextResponse.json(buildErrorPayload("validate_file", new Error(`File "${oversized.name}" exceeds the 50 GB per-file limit.`)), { status: 400 });
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(buildErrorPayload("validate_file", new Error("Batch exceeds the 100 GB total upload limit.")), { status: 400 });
    }

    const shared = {
      source: String(formData.get("source") || "upload").trim(),
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      tags: String(formData.get("tags") || "").trim(),
      featuredHome: String(formData.get("featuredHome") || "false") === "true",
      homeSlot: String(formData.get("homeSlot") || "").trim() || null,
      manualRank: String(formData.get("manualRank") || "0").trim(),
      workflowStatus: String(formData.get("workflowStatus") || "approved").trim(),
      active: String(formData.get("active") || "true") !== "false"
    };

    const results = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const asset = await ingestUploadedMedia({
        buffer,
        mimeType: file.type || "application/octet-stream",
        originalFilename: file.name,
        ...shared,
        title: shared.title || file.name.replace(/\.[^.]+$/, "")
      });
      results.push(asset);
    }

    return NextResponse.json({ ok: true, uploaded: results.length, assets: results });
  } catch (error) {
    const step = error?.step || "upload";
    return NextResponse.json(buildErrorPayload(step, error), { status: 500 });
  }
}
