import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/auth";
import { importGooglePhotosSelection } from "@/core/repository";

export const runtime = "nodejs";

interface ImportBody {
  sessionId?: string;
  selectedIds?: string[];
  titlePrefix?: string;
  description?: string;
  creatorNotes?: string;
  campaign?: string;
  voicePreset?: string;
  tags?: string;
  destinations?: string[];
  scheduledFor?: string;
  approvalPolicy?: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as ImportBody;
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Session id is required." }, { status: 400 });
  }

  const selectedIds = Array.isArray(body.selectedIds)
    ? body.selectedIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  const scheduledFor = String(body.scheduledFor || "").trim()
    ? new Date(String(body.scheduledFor)).toISOString()
    : null;

  try {
    const result = await importGooglePhotosSelection({
      actor: user,
      sessionId,
      selectedIds,
      titlePrefix: String(body.titlePrefix || "").trim(),
      description: String(body.description || "").trim(),
      creatorNotes: String(body.creatorNotes || "").trim() || null,
      campaign: String(body.campaign || "").trim() || null,
      voicePreset: String(body.voicePreset || "drummer_girl") as "playful" | "drummer_girl" | "confident" | "flirty_safe" | "livestream_growth",
      tags: String(body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      destinations: Array.isArray(body.destinations)
        ? body.destinations.map((value) => String(value)) as Array<"tiktok" | "instagram" | "youtube_shorts" | "twitch" | "reddit" | "x" | "facebook" | "pinterest">
        : [],
      scheduledFor,
      approvalPolicy: String(body.approvalPolicy || "human_required") as "human_required" | "auto_post_approved_only"
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import picked Google Photos media." },
      { status: 500 }
    );
  }
}
