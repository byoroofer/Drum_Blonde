const ADMIN_ALLOWED_MODERATION_STATUSES = new Set([
  "approved",
  "review",
  "rejected"
]);

const TRACKING_EVENT_TYPES = new Set(["page_view", "video_play", "link_click"]);

function trimToLength(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function clampInteger(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function normalizeOptionalHttpUrl(value, maxLength = 2048) {
  const trimmed = trimToLength(value, maxLength);
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString().slice(0, maxLength);
  } catch {
    return null;
  }
}

export function isTrustedOriginRequest(request, { allowWhenMissing = false } = {}) {
  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) {
    return allowWhenMissing;
  }

  if (origin) {
    return origin === expectedOrigin;
  }

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function normalizeAdminMediaInput(formValues) {
  const kind = trimToLength(formValues.kind || "", 16).toLowerCase();
  const moderationStatus = trimToLength(
    formValues.moderationStatus || "approved",
    16
  ).toLowerCase();
  const playbackUrl = normalizeOptionalHttpUrl(formValues.playbackUrl);
  const posterUrl = normalizeOptionalHttpUrl(formValues.posterUrl);
  const provider = trimToLength(formValues.provider || "direct", 32).toLowerCase() || "direct";
  const homeSlot = String(formValues.homeSlot || "").trim();

  return {
    id: trimToLength(formValues.id, 128),
    title: trimToLength(formValues.title || "Untitled", 160) || "Untitled",
    description: trimToLength(formValues.description, 2000),
    playbackUrl,
    posterUrl,
    tags: trimToLength(formValues.tags, 300),
    provider,
    moderationStatus: ADMIN_ALLOWED_MODERATION_STATUSES.has(moderationStatus)
      ? moderationStatus
      : "review",
    moderationNotes: trimToLength(formValues.moderationNotes, 1500),
    featuredHome: formValues.featuredHome === true,
    active: formValues.active === true,
    homeSlot: homeSlot ? clampInteger(homeSlot, { min: 1, max: 99, fallback: null }) : null,
    manualRank: clampInteger(formValues.manualRank, { min: 0, max: 1000, fallback: 0 }),
    kind
  };
}

export function parseUploadTokenPayload(tokenPayload) {
  const parsed = tokenPayload ? JSON.parse(tokenPayload) : {};

  return {
    title: trimToLength(parsed.title, 160),
    description: trimToLength(parsed.description, 2000),
    tags: trimToLength(parsed.tags, 300),
    featuredHome: parsed.featuredHome === true || parsed.featuredHome === "true",
    homeSlot: String(parsed.homeSlot || "").trim()
      ? clampInteger(parsed.homeSlot, { min: 1, max: 99, fallback: null })
      : null,
    manualRank: clampInteger(parsed.manualRank, { min: 0, max: 1000, fallback: 0 }),
    thumbnailUrl: normalizeOptionalHttpUrl(parsed.thumbnailUrl),
    posterUrl: normalizeOptionalHttpUrl(parsed.posterUrl),
    playbackUrl: normalizeOptionalHttpUrl(parsed.playbackUrl)
  };
}

export function normalizeTrackingPayload(payload) {
  const type = trimToLength(payload?.type, 32).toLowerCase();
  if (!TRACKING_EVENT_TYPES.has(type)) {
    return null;
  }

  const mediaId = trimToLength(payload?.mediaId, 128) || null;
  const mediaIds = Array.isArray(payload?.mediaIds)
    ? [...new Set(payload.mediaIds.map((value) => trimToLength(value, 128)).filter(Boolean))].slice(0, 24)
    : [];

  return {
    type,
    pathname: trimToLength(payload?.pathname, 256) || null,
    href: normalizeOptionalHttpUrl(payload?.href),
    mediaId,
    mediaIds,
    label: trimToLength(payload?.label, 160) || null
  };
}
