import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/auth";
import {
  buildGooglePhotosOAuthRedirectUri,
  consumeGooglePhotosOAuthState,
  saveGooglePhotosCredentials
} from "@/core/google-photos-auth";
import { env } from "@/core/env";
import { GOOGLE_TOKEN_ENDPOINT, PICKER_SCOPE } from "@/core/google-photos-constants";

export const runtime = "nodejs";

interface GoogleOAuthExchange {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function hasPickerScope(scope: string) {
  return String(scope || "")
    .split(/\s+/)
    .filter(Boolean)
    .includes(PICKER_SCOPE);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").trim();
  const state = String(url.searchParams.get("state") || "").trim();
  const oauthError = String(url.searchParams.get("error") || "").trim();

  if (oauthError) {
    return NextResponse.redirect(new URL(`/admin?tab=library&error=${encodeURIComponent(`Google OAuth was cancelled: ${oauthError}`)}`, request.url));
  }

  const stateValid = await consumeGooglePhotosOAuthState(state);
  if (!stateValid || !code) {
    return NextResponse.redirect(new URL("/admin?tab=library&error=Google%20OAuth%20state%20was%20invalid.", request.url));
  }

  try {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new Error("Google OAuth client credentials are missing.");
    }

    const redirectUri = buildGooglePhotosOAuthRedirectUri(url.origin);
    const body = new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: AbortSignal.timeout(30_000)
    });

    const payload = await response.json() as GoogleOAuthExchange;
    if (!response.ok) {
      throw new Error(payload.error_description || payload.error || "Unable to finish Google OAuth.");
    }

    if (!payload.refresh_token) {
      throw new Error("Google did not return a refresh token. Reconnect again and approve offline access.");
    }

    if (!hasPickerScope(String(payload.scope || ""))) {
      throw new Error("Google OAuth succeeded, but the granted scope was not photospicker.mediaitems.readonly.");
    }

    await saveGooglePhotosCredentials({
      refreshToken: payload.refresh_token,
      scope: String(payload.scope || ""),
      accessToken: payload.access_token || null,
      accessTokenExpiresAt: payload.expires_in ? Date.now() + Math.max(Number(payload.expires_in) - 60, 60) * 1000 : null
    });

    return NextResponse.redirect(new URL("/admin?tab=library&notice=google-linked", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish Google Photos OAuth.";
    return NextResponse.redirect(new URL(`/admin?tab=library&error=${encodeURIComponent(message)}`, request.url));
  }
}
