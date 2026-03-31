import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/core/env";
import { GOOGLE_AUTH_ENDPOINT, PICKER_SCOPE } from "@/core/google-photos-constants";
import { openJson, sealJson } from "@/core/secrets";

const GOOGLE_PHOTOS_COOKIE = "brooke_google_photos_oauth";
const GOOGLE_PHOTOS_STATE_COOKIE = "brooke_google_photos_oauth_state";
const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

export interface StoredGooglePhotosCredentials {
  refreshToken: string;
  scope: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: number | null;
}

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

export function buildGooglePhotosOAuthRedirectUri(origin: string) {
  const normalized = String(origin || env.appUrl || "").trim().replace(/\/$/, "");
  return `${normalized}/api/google-photos/oauth/callback`;
}

export function buildGooglePhotosOAuthUrl(origin: string) {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error("Google OAuth client credentials are missing.");
  }

  const redirectUri = buildGooglePhotosOAuthRedirectUri(origin);
  const state = crypto.randomBytes(24).toString("hex");
  const search = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PICKER_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state
  });

  return {
    state,
    url: `${GOOGLE_AUTH_ENDPOINT}?${search.toString()}`
  };
}

export async function saveGooglePhotosOAuthState(state: string) {
  const store = await cookies();
  store.set(GOOGLE_PHOTOS_STATE_COOKIE, state, buildCookieOptions(OAUTH_STATE_MAX_AGE_SECONDS));
}

export async function consumeGooglePhotosOAuthState(expectedState: string) {
  const store = await cookies();
  const saved = store.get(GOOGLE_PHOTOS_STATE_COOKIE)?.value || "";
  store.delete(GOOGLE_PHOTOS_STATE_COOKIE);
  return Boolean(saved && expectedState && saved === expectedState);
}

export async function getStoredGooglePhotosCredentials() {
  const store = await cookies();
  const sealed = store.get(GOOGLE_PHOTOS_COOKIE)?.value || "";
  return sealed ? openJson<StoredGooglePhotosCredentials>(sealed) : null;
}

export async function saveGooglePhotosCredentials(credentials: StoredGooglePhotosCredentials) {
  const store = await cookies();
  store.set(GOOGLE_PHOTOS_COOKIE, sealJson(credentials), buildCookieOptions(OAUTH_COOKIE_MAX_AGE_SECONDS));
}

export async function clearGooglePhotosCredentials() {
  const store = await cookies();
  store.delete(GOOGLE_PHOTOS_COOKIE);
  store.delete(GOOGLE_PHOTOS_STATE_COOKIE);
}
