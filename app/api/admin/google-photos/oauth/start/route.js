import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getPlatformConfig } from "@/lib/env";
import { isTrustedOriginRequest } from "@/lib/security";
import { PICKER_SCOPE } from "@/lib/google-photos-picker";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isTrustedOriginRequest(request, { allowWhenMissing: true })) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = getPlatformConfig();
  const clientId = config.googleClientId || config.googleOauthClientId;

  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth client is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const maxItemCount = searchParams.get("maxItemCount") || "25";

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const redirectUri = `${proto}://${host}/api/admin/google-photos/oauth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PICKER_SCOPE,
    access_type: "online",
    prompt: "select_account",
    state: maxItemCount
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
