import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getGooglePhotosPickingSession, listGooglePhotosPickedItems, getGooglePhotosPickingSessionWithToken, listGooglePhotosPickedItemsWithToken } from "@/lib/google-photos-picker";
import { isTrustedOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request, context) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const sessionId = String(params?.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Session id is required." }, { status: 400 });
  }

  const pickerToken = String(request.headers.get("x-picker-token") || "").trim();

  try {
    const session = pickerToken
      ? await getGooglePhotosPickingSessionWithToken(sessionId, pickerToken)
      : await getGooglePhotosPickingSession(sessionId);
    const items = session.mediaItemsSet
      ? pickerToken
        ? await listGooglePhotosPickedItemsWithToken(sessionId, pickerToken)
        : await listGooglePhotosPickedItems(sessionId)
      : [];
    return NextResponse.json({ session, items }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read Google Photos picker session." },
      { status: 500 }
    );
  }
}
