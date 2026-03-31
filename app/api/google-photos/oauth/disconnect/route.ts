import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/auth";
import { clearGooglePhotosCredentials } from "@/core/google-photos-auth";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await clearGooglePhotosCredentials();
  return NextResponse.json({ ok: true }, { status: 200 });
}
