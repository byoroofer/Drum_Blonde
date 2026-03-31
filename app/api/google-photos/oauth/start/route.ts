import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/auth";
import { buildGooglePhotosOAuthUrl, saveGooglePhotosOAuthState } from "@/core/google-photos-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    const { state, url } = buildGooglePhotosOAuthUrl(new URL(request.url).origin);
    await saveGooglePhotosOAuthState(state);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Google Photos OAuth.";
    return NextResponse.redirect(new URL(`/admin?tab=library&error=${encodeURIComponent(message)}`, request.url));
  }
}
