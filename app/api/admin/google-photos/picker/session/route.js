import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getGooglePhotosSetupStatus } from "@/lib/env";
import { createGooglePhotosPickingSession, PICKER_SCOPE } from "@/lib/google-photos-picker";
import { isTrustedOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const status = getGooglePhotosSetupStatus();
  if (!status.ready) {
    return NextResponse.json(
      {
        error: "Google Photos Picker is not configured.",
        missing: status.missingRequired,
        requiredScope: PICKER_SCOPE
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
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
