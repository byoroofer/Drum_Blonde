import { isAdminRequest } from "@/lib/admin-auth";
import { getMediaAssetSource } from "@/lib/media-repo";
import { isTrustedOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return Response.json({ ok: false, message: "Forbidden origin." }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const routeParams = await params;
    const source = await getMediaAssetSource(routeParams.id);

    return new Response(source.buffer, {
      status: 200,
      headers: {
        "Content-Type": source.mimeType,
        "Content-Length": String(source.buffer.length),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${source.filename.replace(/"/g, "")}"`
      }
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to fetch media source." },
      { status: 500 }
    );
  }
}
