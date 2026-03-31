import { env, getIntegrationAvailability } from "@/core/env";
import { getStoredGooglePhotosCredentials } from "@/core/google-photos-auth";
import {
  GOOGLE_TOKEN_ENDPOINT,
  PICKER_API_BASE,
  PICKER_SCOPE,
  REQUEST_TIMEOUT_MS
} from "@/core/google-photos-constants";

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;
let cachedAccessTokenKey = "";

export interface GooglePhotosPickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet: boolean;
  expireTime: string | null;
  pollIntervalMs: number;
  timeoutMs: number;
}

export interface GooglePhotosPickedItem {
  id: string;
  createTime: string | null;
  type: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
  baseUrl: string;
  mimeType: string;
  filename: string;
  width: number | null;
  height: number | null;
  videoProcessingStatus: string | null;
}

export interface GooglePhotosPickerConnectionStatus {
  ready: boolean;
  connected: boolean;
  missing: string[];
  source: "cookie" | "env" | null;
  detail: string;
  actionHref: string | null;
  actionLabel: string | null;
  requiredScope: string;
  tone: "good" | "warn" | "bad";
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface ResolvedGooglePhotosCredentials {
  source: "cookie" | "env" | null;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  scope: string;
}

interface RawSessionResponse {
  id?: string;
  pickerUri?: string;
  mediaItemsSet?: boolean;
  expireTime?: string;
  pollingConfig?: {
    pollInterval?: string;
    timeoutIn?: string;
  };
}

interface RawMediaItemsResponse {
  mediaItems?: Array<{
    id?: string;
    createTime?: string;
    type?: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
    mediaFile?: {
      baseUrl?: string;
      mimeType?: string;
      filename?: string;
      mediaFileMetadata?: {
        width?: number;
        height?: number;
        videoMetadata?: {
          processingStatus?: string;
        };
      };
    };
  }>;
  nextPageToken?: string;
}

function parseDurationMs(value: string | undefined, fallbackMs: number) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) {
    return fallbackMs;
  }

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return fallbackMs;
  }

  return Math.max(0, Math.round(seconds * 1000));
}

function hasPickerScope(scope: string) {
  return String(scope || "")
    .split(/\s+/)
    .filter(Boolean)
    .includes(PICKER_SCOPE);
}

function buildScopeError(errorText: string) {
  const normalized = errorText.toLowerCase();
  if (normalized.includes("insufficient authentication scopes") || normalized.includes("photospicker.mediaitems.readonly") || normalized.includes("photoslibrary.readonly")) {
    return new Error(
      "Google Photos Picker requires the photospicker.mediaitems.readonly scope. Reconnect Google Photos from the admin and approve the current Picker flow."
    );
  }

  if (normalized.includes("invalid_grant")) {
    return new Error("Google Photos access expired or was revoked. Reconnect Google Photos from the admin and approve offline access again.");
  }

  return new Error(errorText);
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

async function resolvePickerCredentials(): Promise<ResolvedGooglePhotosCredentials> {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error("Google Photos import is unavailable until the Google OAuth client env vars are configured.");
  }

  const stored = await getStoredGooglePhotosCredentials();
  if (stored?.refreshToken || stored?.accessToken) {
    return {
      source: "cookie",
      refreshToken: String(stored.refreshToken || ""),
      accessToken: String(stored.accessToken || ""),
      accessTokenExpiresAt: Number(stored.accessTokenExpiresAt || 0),
      scope: String(stored.scope || "")
    };
  }

  if (env.googlePhotosRefreshToken || env.googlePhotosAccessToken) {
    return {
      source: "env",
      refreshToken: env.googlePhotosRefreshToken,
      accessToken: env.googlePhotosAccessToken,
      accessTokenExpiresAt: 0,
      scope: ""
    };
  }

  throw new Error("Google Photos import is optional and currently not connected. Connect Google Photos in this admin session or provide GOOGLE_PHOTOS_REFRESH_TOKEN / GOOGLE_PHOTOS_ACCESS_TOKEN.");
}

async function refreshGooglePhotosAccessToken(credentials: ResolvedGooglePhotosCredentials) {
  if (!credentials.refreshToken) {
    if (!credentials.accessToken) {
      throw new Error("Google Photos import is optional and currently not connected. Connect Google Photos in this admin session or provide GOOGLE_PHOTOS_REFRESH_TOKEN / GOOGLE_PHOTOS_ACCESS_TOKEN.");
    }

    if (credentials.scope && !hasPickerScope(credentials.scope)) {
      throw buildScopeError(`Stored access token scope is ${credentials.scope}.`);
    }

    return {
      accessToken: credentials.accessToken,
      expiresAt: Date.now() + 5 * 60 * 1000,
      scope: credentials.scope
    };
  }

  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw buildScopeError(`Google OAuth token refresh failed (${response.status}): ${text}`);
  }

  const payload = JSON.parse(text) as GoogleTokenResponse;
  if (!payload.access_token) {
    throw new Error("Google OAuth token refresh succeeded but did not return an access token.");
  }

  const scope = String(payload.scope || credentials.scope || "").trim();
  if (scope && !hasPickerScope(scope)) {
    throw buildScopeError(`Google OAuth token refresh returned scope ${scope}.`);
  }

  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in || 3600) - 60, 60) * 1000,
    scope
  };
}

export async function getGooglePhotosPickerAccessToken(forceRefresh = false) {
  const credentials = await resolvePickerCredentials();
  const cacheKey = `${credentials.source}:${credentials.refreshToken || credentials.accessToken}`;

  if (!forceRefresh && cachedAccessToken && cacheKey === cachedAccessTokenKey && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!forceRefresh && !credentials.refreshToken && credentials.accessToken) {
    const direct = await refreshGooglePhotosAccessToken(credentials);
    cachedAccessTokenKey = cacheKey;
    cachedAccessToken = direct.accessToken;
    cachedAccessTokenExpiresAt = direct.expiresAt;
    return cachedAccessToken;
  }

  const refreshed = await refreshGooglePhotosAccessToken(credentials);
  cachedAccessTokenKey = cacheKey;
  cachedAccessToken = refreshed.accessToken;
  cachedAccessTokenExpiresAt = refreshed.expiresAt;
  return cachedAccessToken;
}

export async function getGooglePhotosPickerConnectionStatus(): Promise<GooglePhotosPickerConnectionStatus> {
  const integrations = getIntegrationAvailability();
  const missing: string[] = [];

  if (!env.googleClientId) {
    missing.push("GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID");
  }

  if (!env.googleClientSecret) {
    missing.push("GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET");
  }

  if (missing.length) {
    return {
      ready: false,
      connected: false,
      missing,
      source: null,
      detail: "Google Photos import is optional and currently unavailable until the Google OAuth client env vars are configured.",
      actionHref: null,
      actionLabel: null,
      requiredScope: PICKER_SCOPE,
      tone: "warn"
    };
  }

  try {
    const credentials = await resolvePickerCredentials();
    await getGooglePhotosPickerAccessToken();

    return {
      ready: true,
      connected: true,
      missing: [],
      source: credentials.source,
      detail: credentials.source === "cookie"
        ? "Connected through Google OAuth in this admin browser. The picker will refresh access tokens automatically."
        : "Connected from environment variables. The picker will refresh access tokens automatically.",
      actionHref: "/api/google-photos/oauth/start",
      actionLabel: credentials.source === "cookie" ? "Reconnect Google Photos" : "Connect Google Photos",
      requiredScope: PICKER_SCOPE,
      tone: "good"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Photos Picker is not connected.";
    const missingCredentials = !integrations.googlePhotosCredentialsConfigured;

    return {
      ready: false,
      connected: false,
      missing: missingCredentials ? ["GOOGLE_PHOTOS_REFRESH_TOKEN or GOOGLE_PHOTOS_ACCESS_TOKEN"] : [],
      source: null,
      detail: missingCredentials
        ? "Google Photos import is optional and currently not connected. Connect Google Photos in this admin session or provide GOOGLE_PHOTOS_REFRESH_TOKEN / GOOGLE_PHOTOS_ACCESS_TOKEN."
        : message,
      actionHref: "/api/google-photos/oauth/start",
      actionLabel: "Connect Google Photos",
      requiredScope: PICKER_SCOPE,
      tone: "warn"
    };
  }
}

async function pickerRequest<T>(pathname: string, init: RequestInit = {}, retry = true): Promise<T> {
  const accessToken = await getGooglePhotosPickerAccessToken(!retry);
  const response = await fetchWithTimeout(`${PICKER_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  if (response.status === 401 && retry) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresAt = 0;
    cachedAccessTokenKey = "";
    return pickerRequest<T>(pathname, init, false);
  }

  if (!response.ok) {
    throw buildScopeError(`Google Photos Picker request failed (${response.status}): ${text}`);
  }

  return JSON.parse(text) as T;
}

function mapSession(session: RawSessionResponse): GooglePhotosPickerSession {
  return {
    id: String(session.id || ""),
    pickerUri: String(session.pickerUri || ""),
    mediaItemsSet: session.mediaItemsSet === true,
    expireTime: session.expireTime || null,
    pollIntervalMs: parseDurationMs(session.pollingConfig?.pollInterval, 3000),
    timeoutMs: parseDurationMs(session.pollingConfig?.timeoutIn, 60_000)
  };
}

function mapItem(item: NonNullable<RawMediaItemsResponse["mediaItems"]>[number]): GooglePhotosPickedItem {
  return {
    id: String(item.id || ""),
    createTime: item.createTime || null,
    type: item.type || "TYPE_UNSPECIFIED",
    baseUrl: String(item.mediaFile?.baseUrl || ""),
    mimeType: String(item.mediaFile?.mimeType || "application/octet-stream"),
    filename: String(item.mediaFile?.filename || `${item.id || "picked-media"}.bin`),
    width: typeof item.mediaFile?.mediaFileMetadata?.width === "number" ? item.mediaFile.mediaFileMetadata.width : null,
    height: typeof item.mediaFile?.mediaFileMetadata?.height === "number" ? item.mediaFile.mediaFileMetadata.height : null,
    videoProcessingStatus: item.mediaFile?.mediaFileMetadata?.videoMetadata?.processingStatus || null
  };
}

export async function createGooglePhotosPickingSession(maxItemCount = 25) {
  const safeCount = Math.min(2000, Math.max(1, Math.round(maxItemCount || 25)));
  const session = await pickerRequest<RawSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      pickingConfig: {
        maxItemCount: String(safeCount)
      }
    })
  });

  return mapSession(session);
}

export async function getGooglePhotosPickingSession(sessionId: string) {
  const session = await pickerRequest<RawSessionResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
  return mapSession(session);
}

export async function listGooglePhotosPickedItems(sessionId: string) {
  const items: GooglePhotosPickedItem[] = [];
  let nextPageToken = "";

  do {
    const search = new URLSearchParams({ sessionId });
    if (nextPageToken) {
      search.set("pageToken", nextPageToken);
    }

    const response = await pickerRequest<RawMediaItemsResponse>(`/mediaItems?${search.toString()}`);
    for (const item of response.mediaItems || []) {
      if (item.id && item.mediaFile?.baseUrl) {
        items.push(mapItem(item));
      }
    }

    nextPageToken = String(response.nextPageToken || "");
  } while (nextPageToken);

  return items;
}

export async function downloadPickedMediaItem(item: GooglePhotosPickedItem) {
  if (item.type === "VIDEO" && item.videoProcessingStatus && item.videoProcessingStatus !== "READY") {
    throw new Error(`${item.filename} is not ready for download in Google Photos yet.`);
  }

  const accessToken = await getGooglePhotosPickerAccessToken();
  const suffix = item.type === "VIDEO" ? "=dv" : "=d";
  const response = await fetchWithTimeout(`${item.baseUrl}${suffix}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildScopeError(`Google Photos media download failed (${response.status}): ${text}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export { PICKER_SCOPE };
