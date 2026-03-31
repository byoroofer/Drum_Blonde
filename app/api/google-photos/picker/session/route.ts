import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/auth";
import { getGooglePhotosPickerStatus } from "@/core/env";
import { createGooglePhotosPickingSession } from "@/core/google-photos-picker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const status = getGooglePhotosPickerStatus();
  if (!status.ready) {
    return NextResponse.json(
      {
        error: "Google Photos Picker is not configured.",
        missing: status.missing,
        requiredScope: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({})) as { maxItemCount?: number | string };
  const rawCount = Number(body.maxItemCount || 25);
  const maxItemCount = Number.isFinite(rawCount) ? rawCount : 25;

  try {
    const session = await createGooglePhotosPickingSession(maxItemCount);
    return NextResponse.json({ session }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Google Photos picker session." },
      { status: 500 }
    );
  }
}
