import { requireAdmin } from "@/lib/admin-auth";
import { ensureMediaThumbnail, getMediaThumbnailPlaceholderSvg } from "@/lib/media-repo";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  await requireAdmin();

  const url = await ensureMediaThumbnail(params.id);
  if (!url) {
    const svg = await getMediaThumbnailPlaceholderSvg(params.id);
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=300"
      }
    });
  }

  return Response.redirect(url, 307);
}
