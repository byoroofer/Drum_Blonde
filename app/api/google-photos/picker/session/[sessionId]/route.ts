import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/auth";
import { getGooglePhotosPickingSession, listGooglePhotosPickedItems } from "@/core/google-photos-picker";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  if (!sessionId) {
    return NextResponse.json({ error: "Session id is required." }, { status: 400 });
  }

  try {
    const session = await getGooglePhotosPickingSession(sessionId);
    const items = session.mediaItemsSet ? await listGooglePhotosPickedItems(sessionId) : [];
    return NextResponse.json({ session, items }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read Google Photos picker session." },
      { status: 500 }
    );
  }
}