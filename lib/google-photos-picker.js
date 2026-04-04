import { getPlatformConfig } from "@/lib/env";
import { ingestUploadedMedia } from "@/lib/media-repo";

const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PICKER_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const REQUEST_TIMEOUT_MS = 30_000;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function sanitizePositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function buildScopeError(errorText) {
  if (String(errorText || "").toLowerCase().includes("insufficient authentication scopes")) {
    return new Error(
      `Google Photos Picker token is missing the required scope. Generate a new token with ${PICKER_SCOPE} and update GOOGLE_PHOTOS_REFRESH_TOKEN or GOOGLE_PHOTOS_ACCESS_TOKEN.`
    );
  }

  return new Error(errorText);
}

async function fetchWithTimeout(url, init) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

function requirePickerConfig() {
  const config = getPlatformConfig();

  if (!(config.googleClientId || config.googleOauthClientId)) {
    throw new Error("Google Photos Picker is not configured. Add GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID.");
  }

  if (!(config.googleClientSecret || config.googleOauthClientSecret)) {
    throw new Error("Google Photos Picker is not configured. Add GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET.");
  }

  if (!config.googlePhotosRefreshToken && !config.googlePhotosAccessToken) {
    throw new Error("Google Photos Picker is not configured. Add GOOGLE_PHOTOS_ACCESS_TOKEN or GOOGLE_PHOTOS_REFRESH_TOKEN.");
  }
}

export async function getGooglePhotosPickerAccessToken(forceRefresh = false) {
  requirePickerConfig();
  const config = getPlatformConfig();
  const googleClientId = config.googleClientId || config.googleOauthClientId;
  const googleClientSecret = config.googleClientSecret || config.googleOauthClientSecret;

  if (!forceRefresh && config.googlePhotosAccessToken) {
    return config.googlePhotosAccessToken;
  }

  if (!forceRefresh && cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!config.googlePhotosRefreshToken) {
    throw new Error(`GOOGLE_PHOTOS_REFRESH_TOKEN is missing. Generate a token with ${PICKER_SCOPE}.`);
  }

  const body = new URLSearchParams({
    client_id: googleClientId,
    client_secret: googleClientSecret,
    refresh_token: config.googlePhotosRefreshToken,
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

  const payload = JSON.parse(text);
  if (!payload.access_token) {
    throw new Error("Google OAuth token refresh succeeded but did not return an access token.");
  }

  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(Number(payload.expires_in || 3600) - 60, 60) * 1000;
  return cachedAccessToken;
}

async function pickerRequest(pathname, init = {}, retry = true) {
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
  if (response.status === 401 && retry && getPlatformConfig().googlePhotosRefreshToken) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresAt = 0;
    return pickerRequest(pathname, init, false);
  }

  if (!response.ok) {
    throw buildScopeError(`Google Photos Picker request failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function parseDurationMs(value, fallbackMs) {
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

function mapSession(session) {
  return {
    id: String(session.id || ""),
    pickerUri: String(session.pickerUri || ""),
    mediaItemsSet: session.mediaItemsSet === true,
    expireTime: session.expireTime || null,
    pollIntervalMs: parseDurationMs(session.pollingConfig?.pollInterval, 3000),
    timeoutMs: parseDurationMs(session.pollingConfig?.timeoutIn, 60_000)
  };
}

function mapItem(item) {
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
  const safeCount = sanitizePositiveInteger(maxItemCount, 25, { min: 1, max: 2000 });
  const session = await pickerRequest("/sessions", {
    method: "POST",
    body: JSON.stringify({
      pickingConfig: {
        maxItemCount: String(safeCount)
      }
    })
  });

  return mapSession(session);
}

export async function createGooglePhotosPickingSessionWithToken(accessToken, maxItemCount = 25) {
  const safeCount = sanitizePositiveInteger(maxItemCount, 25, { min: 1, max: 2000 });
  const response = await fetchWithTimeout(`${PICKER_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pickingConfig: {
        maxItemCount: String(safeCount)
      }
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw buildScopeError(`Google Photos Picker session creation failed (${response.status}): ${text}`);
  }

  return mapSession(JSON.parse(text));
}

export async function getGooglePhotosPickingSession(sessionId) {
  const session = await pickerRequest(`/sessions/${encodeURIComponent(String(sessionId || "").trim())}`);
  return mapSession(session);
}

export async function getGooglePhotosPickingSessionWithToken(sessionId, accessToken) {
  const response = await fetchWithTimeout(`${PICKER_API_BASE}/sessions/${encodeURIComponent(String(sessionId || "").trim())}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
  });
  const text = await response.text();
  if (!response.ok) throw buildScopeError(`Google Photos Picker session poll failed (${response.status}): ${text}`);
  return mapSession(JSON.parse(text));
}

export async function listGooglePhotosPickedItems(sessionId) {
  const items = [];
  let nextPageToken = "";

  do {
    const search = new URLSearchParams({ sessionId: String(sessionId || "").trim() });
    if (nextPageToken) {
      search.set("pageToken", nextPageToken);
    }

    const response = await pickerRequest(`/mediaItems?${search.toString()}`);
    for (const item of response.mediaItems || []) {
      if (item.id && item.mediaFile?.baseUrl) {
        items.push(mapItem(item));
      }
    }

    nextPageToken = String(response.nextPageToken || "");
  } while (nextPageToken);

  return items;
}

export async function listGooglePhotosPickedItemsWithToken(sessionId, accessToken) {
  const items = [];
  let nextPageToken = "";
  do {
    const search = new URLSearchParams({ sessionId: String(sessionId || "").trim() });
    if (nextPageToken) search.set("pageToken", nextPageToken);
    const response = await fetchWithTimeout(`${PICKER_API_BASE}/mediaItems?${search.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    });
    const text = await response.text();
    if (!response.ok) throw buildScopeError(`Google Photos media list failed (${response.status}): ${text}`);
    const data = JSON.parse(text);
    for (const item of data.mediaItems || []) {
      if (item.id && item.mediaFile?.baseUrl) items.push(mapItem(item));
    }
    nextPageToken = String(data.nextPageToken || "");
  } while (nextPageToken);
  return items;
}

export async function importGooglePhotosSelectionWithToken({
  accessToken,
  sessionId,
  selectedIds = [],
  titlePrefix = "",
  description = "",
  tags = "google-photos, drumbrooke",
  manualRank = 0,
  homeSlot = null,
  featuredHome = false,
  workflowStatus = "approved"
}) {
  const pickedItems = await listGooglePhotosPickedItemsWithToken(sessionId, accessToken);
  const desiredIds = new Set(
    Array.isArray(selectedIds) ? selectedIds.map((v) => String(v || "").trim()).filter(Boolean) : []
  );
  const itemsToImport = desiredIds.size ? pickedItems.filter((item) => desiredIds.has(item.id)) : pickedItems;
  const normalizedStatus = String(workflowStatus || "approved").trim().toLowerCase() || "approved";
  const summary = { importedCount: 0, failedCount: 0, skippedCount: Math.max(0, pickedItems.length - itemsToImport.length), selectedCount: itemsToImport.length, details: [] };

  for (const item of itemsToImport) {
    try {
      const buffer = await downloadPickedMediaItemWithToken(item, accessToken);
      const baseName = stripExtension(item.filename) || "Google Photos asset";
      const title = titlePrefix ? `${titlePrefix} ${baseName}`.trim() : baseName;
      const asset = await ingestUploadedMedia({ buffer, mimeType: item.mimeType || "application/octet-stream", originalFilename: item.filename, source: "google_photos_picker", title, description: String(description || "").trim(), tags: String(tags || "").trim(), featuredHome: featuredHome === true, homeSlot: String(homeSlot || "").trim() || null, manualRank: sanitizePositiveInteger(manualRank, 0, { min: 0, max: 1000 }), workflowStatus: normalizedStatus, active: normalizedStatus === "approved" });
      summary.importedCount += 1;
      summary.details.push({ id: item.id, filename: item.filename, outcome: "imported", assetId: asset.id });
    } catch (error) {
      summary.failedCount += 1;
      summary.details.push({ id: item.id, filename: item.filename, outcome: "failed", error: error instanceof Error ? error.message : String(error || "Import failed.") });
    }
  }
  return summary;
}

async function downloadPickedMediaItemWithToken(item, accessToken) {
  if (item.type === "VIDEO" && item.videoProcessingStatus && item.videoProcessingStatus !== "READY") {
    throw new Error(`${item.filename} is not ready for download yet.`);
  }
  const suffix = item.type === "VIDEO" ? "=dv" : "=d";
  const response = await fetchWithTimeout(`${item.baseUrl}${suffix}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw buildScopeError(`Google Photos media download failed (${response.status}): ${text}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function downloadPickedMediaItem(item) {
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

export async function importGooglePhotosSelection({
  sessionId,
  selectedIds = [],
  titlePrefix = "",
  description = "",
  tags = "google-photos, drumbrooke",
  manualRank = 0,
  homeSlot = null,
  featuredHome = false,
  workflowStatus = "approved"
}) {
  const pickedItems = await listGooglePhotosPickedItems(sessionId);
  const desiredIds = new Set(
    Array.isArray(selectedIds)
      ? selectedIds.map((value) => String(value || "").trim()).filter(Boolean)
      : []
  );
  const itemsToImport = desiredIds.size
    ? pickedItems.filter((item) => desiredIds.has(item.id))
    : pickedItems;

  const normalizedWorkflowStatus = String(workflowStatus || "approved").trim().toLowerCase() || "approved";
  const summary = {
    importedCount: 0,
    failedCount: 0,
    skippedCount: Math.max(0, pickedItems.length - itemsToImport.length),
    selectedCount: itemsToImport.length,
    details: []
  };

  for (const item of itemsToImport) {
    try {
      const buffer = await downloadPickedMediaItem(item);
      const baseName = stripExtension(item.filename) || "Google Photos asset";
      const title = titlePrefix ? `${titlePrefix} ${baseName}`.trim() : baseName;
      const asset = await ingestUploadedMedia({
        buffer,
        mimeType: item.mimeType || "application/octet-stream",
        originalFilename: item.filename,
        source: "google_photos_picker",
        title,
        description: String(description || "").trim(),
        tags: String(tags || "").trim(),
        featuredHome: featuredHome === true,
        homeSlot: String(homeSlot || "").trim() || null,
        manualRank: sanitizePositiveInteger(manualRank, 0, { min: 0, max: 1000 }),
        workflowStatus: normalizedWorkflowStatus,
        active: normalizedWorkflowStatus === "approved"
      });

      summary.importedCount += 1;
      summary.details.push({
        id: item.id,
        filename: item.filename,
        outcome: "imported",
        assetId: asset.id
      });
    } catch (error) {
      summary.failedCount += 1;
      summary.details.push({
        id: item.id,
        filename: item.filename,
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error || "Import failed.")
      });
    }
  }

  return summary;
}

export { PICKER_SCOPE };
