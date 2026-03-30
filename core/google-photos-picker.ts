import { env } from "@/core/env";

const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PICKER_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const REQUEST_TIMEOUT_MS = 30_000;

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

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

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
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

function requirePickerConfig() {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error("Google Photos Picker is not configured. Add GOOGLE_CLIENT_ID/SECRET or GOOGLE_OAUTH_CLIENT_ID/SECRET.");
  }

  if (!env.googlePhotosRefreshToken && !env.googlePhotosAccessToken) {
    throw new Error("Google Photos Picker is not configured. Add GOOGLE_PHOTOS_REFRESH_TOKEN or GOOGLE_PHOTOS_ACCESS_TOKEN.");
  }
}

function buildScopeError(errorText: string) {
  if (errorText.toLowerCase().includes("insufficient authentication scopes")) {
    return new Error(
      "Google Photos Picker token is missing the photospicker.mediaitems.readonly scope. Generate a new token with https://www.googleapis.com/auth/photospicker.mediaitems.readonly and update GOOGLE_PHOTOS_REFRESH_TOKEN."
    );
  }

  return new Error(errorText);
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

export async function getGooglePhotosPickerAccessToken(forceRefresh = false) {
  requirePickerConfig();

  if (!forceRefresh && env.googlePhotosAccessToken) {
    return env.googlePhotosAccessToken;
  }

  if (!forceRefresh && cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!env.googlePhotosRefreshToken) {
    throw new Error("GOOGLE_PHOTOS_REFRESH_TOKEN is missing. Generate a token with the Google Photos Picker scope.");
  }

  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    refresh_token: env.googlePhotosRefreshToken,
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

  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(Number(payload.expires_in || 3600) - 60, 60) * 1000;
  return cachedAccessToken;
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
  if (response.status === 401 && retry && env.googlePhotosRefreshToken) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresAt = 0;
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
