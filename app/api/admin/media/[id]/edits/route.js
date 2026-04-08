import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { createDerivedMediaEdit } from "@/lib/media-repo";
import { isTrustedOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

function buildRedirect(returnTo, mediaId) {
  const fallback = "/admin/media";
  const input = String(returnTo || fallback).trim();
  const url = new URL(input.startsWith("http") ? input : `https://local${input.startsWith("/") ? input : fallback}`);
  url.searchParams.set("save", "edited");
  url.searchParams.set("media", mediaId);
  url.searchParams.delete("reason");
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function POST(request, { params }) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return Response.json({ ok: false, message: "Forbidden origin." }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const routeParams = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const coverFile = formData.get("coverFile");

    if (!(file instanceof File)) {
      return Response.json({ ok: false, message: "Edited media file is required." }, { status: 400 });
    }

    const asset = await createDerivedMediaEdit({
      id: routeParams.id,
      fileBuffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || "application/octet-stream",
      originalFilename: file.name,
      editType: String(formData.get("editType") || "").trim() || (file.type.startsWith("video/") ? "video" : "image"),
      editPayload: (() => {
        const raw = formData.get("editPayload");
        if (!raw) {
          return {};
        }

        try {
          return JSON.parse(String(raw));
        } catch {
          return {};
        }
      })(),
      width: Number(formData.get("width") || "") || null,
      height: Number(formData.get("height") || "") || null,
      durationMs: Number(formData.get("durationMs") || "") || null,
      coverBuffer: coverFile instanceof File ? Buffer.from(await coverFile.arrayBuffer()) : null,
      coverMimeType: coverFile instanceof File ? (coverFile.type || "image/jpeg") : "image/jpeg",
      coverTimeSeconds: Number(formData.get("coverTimeSeconds") || "") || null
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/media");
    revalidatePath("/gallery");

    return Response.json({
      ok: true,
      asset,
      redirectTo: buildRedirect(formData.get("returnTo"), asset.id)
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Edit save failed." },
      { status: 500 }
    );
  }
}
