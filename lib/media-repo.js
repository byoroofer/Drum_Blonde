import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffprobe from "ffprobe-static";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { siteData } from "@/data/siteData";
import { createSupabaseAdminClient, getMediaBucketName, usePublicMediaUrls } from "@/lib/supabase-admin";

const FILTER_CONFIG_ROW_ID = "default";
const DEFAULT_FILTER_CONFIG = {
  enabled: false,
  nsfw_detection: false,
  face_detection: false,
  object_detection: false,
  strict_mode: false,
  show_hidden_media: false
};
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

function nowIso() {
  return new Date().toISOString();
}

function createLogEntry(step, status, detail = {}) {
  return {
    step,
    status,
    at: nowIso(),
    ...detail
  };
}

function toJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value) {
  return toJsonArray(value)
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function appendLog(value, entry) {
  return [...toJsonArray(value), entry];
}

function serializeError(error, step) {
  if (error instanceof Error) {
    return {
      step,
      message: error.message,
      raw: {
        name: error.name,
        stack: error.stack || ""
      }
    };
  }

  if (error && typeof error === "object") {
    return {
      step,
      message: String(error.message || error.code || "Unknown error object"),
      raw: error
    };
  }

  return {
    step,
    message: String(error || "Unknown error"),
    raw: error
  };
}

function buildStructuredError(step, error) {
  const payload = serializeError(error, step);
  const wrapped = new Error(payload.message);
  wrapped.step = step;
  wrapped.raw = payload.raw;
  return wrapped;
}

function sanitizePathSegment(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeFilename(filename, fallback = "asset") {
  const base = sanitizePathSegment(path.basename(String(filename || "")));
  return base || fallback;
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function buildVideoThumbnailSvg(label = "Video") {
  const safeLabel = escapeSvgText(String(label || "Video").trim() || "Video").slice(0, 48);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${safeLabel}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#160f25" />
          <stop offset="100%" stop-color="#3f1d5e" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" rx="48" fill="url(#bg)" />
      <circle cx="600" cy="390" r="124" fill="rgba(255,255,255,0.14)" />
      <polygon points="565,320 565,460 690,390" fill="#ffffff" />
      <text x="600" y="650" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="700" text-anchor="middle">Video</text>
      <text x="600" y="718" fill="rgba(255,255,255,0.82)" font-family="Arial, sans-serif" font-size="34" text-anchor="middle">${safeLabel}</text>
    </svg>
  `.trim();
}

export function buildVideoThumbnailDataUrl(label) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildVideoThumbnailSvg(label))}`;
}

function appendSeekCandidate(candidates, value, maxSeconds) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return;
  }

  const boundedMax = Number.isFinite(maxSeconds) ? Math.max(0.12, maxSeconds) : null;
  const clamped = boundedMax == null ? numeric : Math.min(Math.max(0.12, numeric), boundedMax);
  if (candidates.some((entry) => Math.abs(entry - clamped) < 0.08)) {
    return;
  }

  candidates.push(Number(clamped.toFixed(2)));
}

function buildThumbnailSeekCandidates(durationSeconds) {
  const duration = Number(durationSeconds);
  const safeEnd = Number.isFinite(duration) && duration > 0 ? Math.max(0.12, duration - 0.12) : null;
  const candidates = [];

  if (safeEnd != null) {
    appendSeekCandidate(candidates, Math.min(Math.max(duration * 0.18, 0.45), 3.2), safeEnd);
    appendSeekCandidate(candidates, Math.min(Math.max(duration * 0.12, 0.3), 2.2), safeEnd);
    appendSeekCandidate(candidates, 1.6, safeEnd);
    appendSeekCandidate(candidates, 0.8, safeEnd);
    appendSeekCandidate(candidates, 2.6, safeEnd);
    appendSeekCandidate(candidates, 0.15, safeEnd);
  } else {
    appendSeekCandidate(candidates, 1.6, null);
    appendSeekCandidate(candidates, 0.8, null);
    appendSeekCandidate(candidates, 2.6, null);
    appendSeekCandidate(candidates, 0.15, null);
  }

  return candidates.length ? candidates : [0.15];
}

async function isLowInformationThumbnail(buffer) {
  try {
    const { data, info } = await sharp(buffer)
      .resize(48, 48, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channelCount = Math.max(1, Number(info.channels) || 3);
    const pixelCount = Math.max(1, Math.floor(data.length / channelCount));
    let luminanceSum = 0;
    let luminanceSquareSum = 0;

    for (let index = 0; index < data.length; index += channelCount) {
      const red = data[index] || 0;
      const green = data[index + 1] || 0;
      const blue = data[index + 2] || 0;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
    }

    const average = luminanceSum / pixelCount;
    const variance = Math.max(0, luminanceSquareSum / pixelCount - average * average);
    const standardDeviation = Math.sqrt(variance);
    return average < 26 && standardDeviation < 18;
  } catch {
    return false;
  }
}

async function extractVideoThumbnailFrame(tempFilePath, seekSeconds) {
  const frameOut = `${tempFilePath}_${String(seekSeconds).replace(/\./g, "_")}_thumb.jpg`;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegStatic, [
        "-ss",
        String(seekSeconds),
        "-i",
        tempFilePath,
        "-frames:v",
        "1",
        "-update",
        "1",
        "-q:v",
        "3",
        "-y",
        frameOut
      ]);
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    });

    return await fs.readFile(frameOut);
  } finally {
    await fs.unlink(frameOut).catch(() => {});
  }
}

function buildStoragePath({ source, filename }) {
  const extension = path.extname(filename || "") || "";
  const safeName = sanitizePathSegment(stripExtension(filename) || "asset") || "asset";
  return `${sanitizePathSegment(source || "upload")}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}${extension}`;
}

function assertSupabaseResult(step, result) {
  if (result.error) {
    throw buildStructuredError(step, result.error);
  }

  return result.data;
}

function coerceNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferVideoProvider(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes("supabase.co/storage")) {
    return "supabase";
  }
  if (value.includes("stream.mux.com")) {
    return "mux";
  }
  if (value.includes("videodelivery.net")) {
    return "cloudflare";
  }
  if (value.endsWith(".m3u8") || value.includes(".m3u8?")) {
    return "hls";
  }
  return "direct";
}

function normalizeFilterConfig(config) {
  return {
    enabled: config?.enabled === true,
    nsfw_detection: config?.nsfw_detection === true,
    face_detection: config?.face_detection === true,
    object_detection: config?.object_detection === true,
    strict_mode: config?.strict_mode === true,
    show_hidden_media: config?.show_hidden_media === true
  };
}

async function getSignedOrPublicUrl(storagePath) {
  if (!storagePath) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const bucket = getMediaBucketName();
  const storage = supabase.storage.from(bucket);

  if (usePublicMediaUrls()) {
    return storage.getPublicUrl(storagePath).data.publicUrl;
  }

  const signed = await storage.createSignedUrl(storagePath, DEFAULT_SIGNED_URL_TTL_SECONDS);
  return assertSupabaseResult("create_signed_url", signed)?.signedUrl || null;
}

async function resolveAssetUrls(row) {
  const publicUrl = row.public_url || (await getSignedOrPublicUrl(row.storage_path));
  const thumbnailUrl = row.thumbnail_url || (row.thumbnail_storage_path ? await getSignedOrPublicUrl(row.thumbnail_storage_path) : null);

  return {
    publicUrl,
    thumbnailUrl,
    posterUrl: thumbnailUrl
  };
}

function computeSmartScore(item) {
  return (
    (item.manualRank || 0) * 15 +
    (item.featuredHome ? 200 : 0) +
    (item.views || 0) +
    (item.plays || 0) * 4 +
    (item.clicks || 0) * 3
  );
}

function clampManualRank(value, fallback = 0) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(-10, Math.min(10, numeric));
}

function getEffectiveStatus(row) {
  return row.override_status || row.workflow_status || "approved";
}

function isExplicitSpotlightSlot(value) {
  return Number(value) === 0;
}

function clampClipSecond(value, fallback = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.round(numeric);
}

function getPlaybackSettingsFromLog(row) {
  const durationSeconds = row?.duration_ms == null ? null : Math.max(0, Math.round(Number(row.duration_ms) / 1000));
  const logs = toJsonArray(row?.processing_log);

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index];
    const fields = entry?.fields && typeof entry.fields === "object" ? entry.fields : entry;
    const hasClipStart = Object.prototype.hasOwnProperty.call(fields || {}, "clip_start_seconds");
    const hasClipEnd = Object.prototype.hasOwnProperty.call(fields || {}, "clip_end_seconds");
    if (!hasClipStart && !hasClipEnd) {
      continue;
    }

    let clipStartSeconds = clampClipSecond(fields.clip_start_seconds, 0) || 0;
    let clipEndSeconds = clampClipSecond(fields.clip_end_seconds, null);

    if (durationSeconds != null) {
      clipStartSeconds = Math.min(clipStartSeconds, Math.max(0, durationSeconds - 1));
      if (clipEndSeconds != null) {
        clipEndSeconds = Math.min(clipEndSeconds, durationSeconds);
      }
    }

    if (clipEndSeconds != null && clipEndSeconds <= clipStartSeconds) {
      clipEndSeconds = durationSeconds != null && durationSeconds > clipStartSeconds
        ? durationSeconds
        : null;
    }

    if (durationSeconds != null && clipEndSeconds != null && clipEndSeconds >= durationSeconds) {
      clipEndSeconds = null;
    }

    return {
      clipStartSeconds,
      clipEndSeconds
    };
  }

  return {
    clipStartSeconds: 0,
    clipEndSeconds: null
  };
}

function sanitizeClipRange(values, durationSeconds) {
  let clipStartSeconds = clampClipSecond(values.clipStartSeconds, 0) || 0;
  let clipEndSeconds = clampClipSecond(values.clipEndSeconds, null);
  const maxDuration = Number.isFinite(durationSeconds) ? Math.max(0, Number(durationSeconds)) : null;

  if (maxDuration != null) {
    clipStartSeconds = Math.min(clipStartSeconds, Math.max(0, maxDuration - 1));
    if (clipEndSeconds != null) {
      clipEndSeconds = Math.min(clipEndSeconds, maxDuration);
    }
  }

  if (clipEndSeconds != null && clipEndSeconds <= clipStartSeconds) {
    clipEndSeconds = maxDuration != null && maxDuration > clipStartSeconds
      ? maxDuration
      : null;
  }

  if (maxDuration != null && clipEndSeconds != null && clipEndSeconds >= maxDuration) {
    clipEndSeconds = null;
  }

  return {
    clipStartSeconds,
    clipEndSeconds
  };
}

function normalizeAlbumRow(row, assetCount = 0) {
  const slug = sanitizePathSegment(row?.slug || row?.name || "album");

  return {
    id: row?.id || slug,
    name: String(row?.name || slug),
    slug,
    description: String(row?.description || ""),
    assetCount: Number(assetCount || 0),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null
  };
}

function buildAlbumLookup(albumRows, mediaRows = []) {
  const counts = new Map();

  for (const row of mediaRows) {
    for (const slug of toStringArray(row.album_slugs)) {
      counts.set(slug, Number(counts.get(slug) || 0) + 1);
    }
  }

  return new Map(
    albumRows.map((row) => {
      const album = normalizeAlbumRow(row, counts.get(sanitizePathSegment(row.slug || row.name)) || 0);
      return [album.slug, album];
    })
  );
}

async function normalizeRow(row, albumLookup = new Map()) {
  const urls = await resolveAssetUrls(row);
  const kind = row.mime_type?.startsWith("video/") ? "video" : row.mime_type?.startsWith("image/") ? "image" : row.kind || "image";
  const url = urls.publicUrl || row.public_url || null;
  const videoPlaceholder = kind === "video" ? buildVideoThumbnailDataUrl(row.title || stripExtension(row.original_filename) || "Video") : null;
  const playbackSettings = getPlaybackSettingsFromLog(row);

  const albumSlugs = toStringArray(row.album_slugs).map((value) => sanitizePathSegment(value));
  const albums = albumSlugs.map((slug) => albumLookup.get(slug) || normalizeAlbumRow({ id: slug, slug, name: slug.replace(/-/g, " ") }));

  const item = {
    id: row.id,
    source: row.source,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    url,
    playbackUrl: kind === "video" ? url : null,
    storedThumbnailUrl: urls.thumbnailUrl || null,
    placeholderThumbnailUrl: videoPlaceholder,
    thumbnailUrl: urls.thumbnailUrl || videoPlaceholder,
    posterUrl: urls.posterUrl || videoPlaceholder,
    adminThumbnailUrl: row.id ? (urls.thumbnailUrl || `/api/admin/media/${row.id}/thumbnail`) : (urls.thumbnailUrl || videoPlaceholder),
    thumbnailBackfillUrl: kind === "video" && row.id ? `/api/admin/media/${row.id}/thumbnail` : null,
    hasStoredThumbnail: Boolean(urls.thumbnailUrl || row.thumbnail_storage_path || row.thumbnail_url),
    thumbnailStoragePath: row.thumbnail_storage_path || null,
    title: row.title || stripExtension(row.original_filename) || "Untitled asset",
    description: row.description || "",
    tags: row.tags || "",
    mimeType: row.mime_type || "application/octet-stream",
    kind,
    fileSizeBytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    byteSize: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    durationSeconds: row.duration_ms == null ? null : Math.round(Number(row.duration_ms) / 1000),
    checksum: row.checksum || null,
    isFlagged: row.is_flagged === true,
    isFiltered: row.is_filtered === true,
    filterReason: row.filter_reason || "",
    filterConfidence: row.filter_confidence == null ? null : Number(row.filter_confidence),
    overrideStatus: row.override_status || null,
    overrideBy: row.override_by || null,
    overrideNotes: row.override_notes || "",
    workflowStatus: row.workflow_status || "approved",
    moderationStatus: getEffectiveStatus(row),
    ingestionLog: toJsonArray(row.ingestion_log),
    processingLog: toJsonArray(row.processing_log),
    errorLog: toJsonArray(row.error_log),
    isHidden: row.is_hidden === true,
    hiddenAt: row.hidden_at || null,
    hiddenReason: row.hidden_reason || "",
    albumSlugs,
    albumNames: albums.map((album) => album.name),
    albums,
    featuredHome: row.featured_home === true,
    homeSlot: row.home_slot == null ? null : Number(row.home_slot),
    spotlightHome: isExplicitSpotlightSlot(row.home_slot),
    manualRank: clampManualRank(row.manual_rank, 0),
    clipStartSeconds: playbackSettings.clipStartSeconds,
    clipEndSeconds: playbackSettings.clipEndSeconds,
    active: row.is_active !== false,
    views: row.views == null ? 0 : Number(row.views),
    plays: row.plays == null ? 0 : Number(row.plays),
    clicks: row.clicks == null ? 0 : Number(row.clicks),
    provider: kind === "video" ? inferVideoProvider(url) : "supabase",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  return {
    ...item,
    smartScore: computeSmartScore(item)
  };
}

async function listRows() {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });

  return assertSupabaseResult("select_media_assets", result) || [];
}

async function listAlbumRows() {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("media_albums")
    .select("*")
    .order("name", { ascending: true });

  return assertSupabaseResult("select_media_albums", result) || [];
}

async function getAlbumLookupForRows(rows) {
  try {
    const albumRows = await listAlbumRows();
    return buildAlbumLookup(albumRows, rows);
  } catch (error) {
    console.error("[media-engine] album lookup fallback", error);
    return new Map();
  }
}

async function writeMediaUpdate(id, payload) {
  const supabase = createSupabaseAdminClient();
  const cleanedPayload = Object.fromEntries(
    Object.entries({ ...payload, updated_at: nowIso() }).filter(([, value]) => value !== undefined)
  );
  const result = await supabase
    .from("media_assets")
    .update(cleanedPayload)
    .eq("id", id)
    .select("*")
    .single();

  return assertSupabaseResult("update_media_asset", result);
}

async function getMediaRowById(id) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", id)
    .single();

  return assertSupabaseResult("select_media_asset", result);
}

async function ensureEngineConfigRow() {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("media_engine_config")
    .select("*")
    .eq("id", FILTER_CONFIG_ROW_ID)
    .maybeSingle();

  if (existing.error) {
    throw buildStructuredError("select_media_engine_config", existing.error);
  }

  if (existing.data) {
    return existing.data;
  }

  const inserted = await supabase
    .from("media_engine_config")
    .upsert(
      {
        id: FILTER_CONFIG_ROW_ID,
        filter_config: DEFAULT_FILTER_CONFIG,
        updated_at: nowIso()
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  return assertSupabaseResult("insert_media_engine_config", inserted);
}

export async function getMediaEngineConfig() {
  try {
    const row = await ensureEngineConfigRow();
    return normalizeFilterConfig(row.filter_config || DEFAULT_FILTER_CONFIG);
  } catch (error) {
    console.error("[media-engine] config fallback", error);
    return { ...DEFAULT_FILTER_CONFIG };
  }
}

export async function updateMediaEngineConfig(values) {
  const nextConfig = normalizeFilterConfig(values);
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("media_engine_config")
    .upsert(
      {
        id: FILTER_CONFIG_ROW_ID,
        filter_config: nextConfig,
        updated_at: nowIso()
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  assertSupabaseResult("upsert_media_engine_config", result);
  return nextConfig;
}

function buildFilterDecision({ asset, config }) {
  const processingLog = [];

  if (!config.enabled) {
    processingLog.push(createLogEntry("filtering", "skipped", {
      reason: "filter_config.enabled is false"
    }));

    return {
      is_flagged: false,
      is_filtered: false,
      filter_reason: null,
      filter_confidence: null,
      processingLog
    };
  }

  const signals = [];
  const haystack = [asset.originalFilename, asset.title, asset.description, asset.tags]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (config.nsfw_detection) {
    const matched = ["nsfw", "nude", "explicit", "onlyfans"].filter((term) => haystack.includes(term));
    processingLog.push(createLogEntry("nsfw_detection", "completed", {
      matched_terms: matched,
      mode: "metadata-heuristic"
    }));

    if (matched.length) {
      signals.push({ reason: `nsfw heuristic: ${matched.join(", ")}`, confidence: 0.42 });
    }
  } else {
    processingLog.push(createLogEntry("nsfw_detection", "disabled"));
  }

  if (config.face_detection) {
    processingLog.push(createLogEntry("face_detection", "disabled", {
      reason: "module not implemented; config toggle captured only"
    }));
  }

  if (config.object_detection) {
    processingLog.push(createLogEntry("object_detection", "disabled", {
      reason: "module not implemented; config toggle captured only"
    }));
  }

  const topSignal = signals[0] || null;
  return {
    is_flagged: Boolean(topSignal),
    is_filtered: Boolean(topSignal) && config.strict_mode,
    filter_reason: topSignal?.reason || null,
    filter_confidence: topSignal?.confidence || null,
    processingLog: [
      ...processingLog,
      createLogEntry("filter_summary", "completed", {
        enabled: true,
        strict_mode: config.strict_mode,
        signals
      })
    ]
  };
}

async function runProbe(filePath) {
  if (!ffprobe?.path) {
    return {
      width: null,
      height: null,
      durationMs: null,
      processingLog: [createLogEntry("ffprobe", "skipped", { reason: "ffprobe-static missing" })]
    };
  }

  let output;
  try {
    output = await new Promise((resolve, reject) => {
      const stdout = [];
      const stderr = [];
      const child = spawn(ffprobe.path, [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        filePath
      ]);

      child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
      child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(Buffer.concat(stderr).toString("utf8") || `ffprobe exited with ${code}`));
          return;
        }
        resolve(Buffer.concat(stdout).toString("utf8"));
      });
    });
  } catch (spawnError) {
    return {
      width: null,
      height: null,
      durationMs: null,
      processingLog: [createLogEntry("ffprobe", "skipped", { reason: spawnError.message || "ffprobe unavailable" })]
    };
  }

  const payload = JSON.parse(output);
  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === "video") || streams[0] || null;
  const durationSeconds = coerceNumber(payload.format?.duration, null);

  return {
    width: videoStream?.width == null ? null : Number(videoStream.width),
    height: videoStream?.height == null ? null : Number(videoStream.height),
    durationMs: durationSeconds == null ? null : Math.round(durationSeconds * 1000),
    processingLog: [
      createLogEntry("ffprobe", "completed", {
        width: videoStream?.width || null,
        height: videoStream?.height || null,
        duration_seconds: durationSeconds
      })
    ]
  };
}

async function generateThumbnailBuffer(buffer, mimeType, tempFilePath) {
  try {
    if (mimeType.startsWith("image/")) {
      return await sharp(buffer).resize(600, null, { withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    }

    if (mimeType.startsWith("video/") && ffmpegStatic) {
      const probe = await runProbe(tempFilePath);
      const candidates = buildThumbnailSeekCandidates(
        probe.durationMs == null ? null : Number(probe.durationMs) / 1000
      );

      for (const seekSeconds of candidates) {
        const frameBuffer = await extractVideoThumbnailFrame(tempFilePath, seekSeconds);
        if (!frameBuffer?.length) {
          continue;
        }

        if (await isLowInformationThumbnail(frameBuffer)) {
          continue;
        }

        return await sharp(frameBuffer).resize(600, null, { withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      }

      const fallbackFrame = await extractVideoThumbnailFrame(tempFilePath, candidates[0] || 0.15);
      if (fallbackFrame?.length) {
        return await sharp(fallbackFrame).resize(600, null, { withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      }
    }
  } catch {
    // Thumbnail generation is best-effort — never block ingestion
  }
  return null;
}

function clampEditorNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(numeric, min), max);
}

function getEditorImageFormat(mimeType, hasAlpha) {
  const value = String(mimeType || "").toLowerCase();

  if (value.includes("png") || hasAlpha) {
    return { mimeType: "image/png", extension: ".png" };
  }

  if (value.includes("webp")) {
    return { mimeType: "image/webp", extension: ".webp" };
  }

  return { mimeType: "image/jpeg", extension: ".jpg" };
}

async function runFfmpegCommand(args, step = "ffmpeg_edit") {
  if (!ffmpegStatic) {
    throw buildStructuredError(step, new Error("ffmpeg-static is not available for video editing."));
  }

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegStatic, args);
    const stderr = [];

    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(Buffer.concat(stderr).toString("utf8") || `ffmpeg exited with ${code}`));
    });
  });
}

async function buildEditedVideoBuffer({
  inputPath,
  outputPath,
  trimStartSeconds,
  trimEndSeconds,
  muteAudio
}) {
  const safeStart = clampClipSecond(trimStartSeconds, 0) || 0;
  const safeEnd = clampClipSecond(trimEndSeconds, null);
  const args = ["-y"];

  if (safeStart > 0) {
    args.push("-ss", String(safeStart));
  }

  args.push("-i", inputPath);

  if (safeEnd != null && safeEnd > safeStart) {
    args.push("-t", String(safeEnd - safeStart));
  }

  args.push(
    "-map",
    "0:v:0",
    "-map_metadata",
    "0",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart"
  );

  if (muteAudio) {
    args.push("-an");
  } else {
    args.push("-map", "0:a?", "-c:a", "aac", "-b:a", "192k");
  }

  args.push(outputPath);

  await runFfmpegCommand(args, "edit_video_asset");
  return fs.readFile(outputPath);
}

async function buildEditedImageBuffer({
  buffer,
  mimeType,
  rotateDegrees,
  brightness,
  contrast,
  saturation
}) {
  const base = sharp(buffer, { failOn: "none" }).rotate(Number(rotateDegrees || 0));
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  let pipeline = base.modulate({
    brightness,
    saturation
  });

  if (Math.abs(contrast - 1) > 0.001) {
    const offset = -(128 * contrast) + 128;
    pipeline = pipeline.linear(contrast, offset);
  }

  const format = getEditorImageFormat(mimeType, metadata.hasAlpha === true);

  if (format.mimeType === "image/png") {
    return {
      buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
      mimeType: format.mimeType,
      extension: format.extension
    };
  }

  if (format.mimeType === "image/webp") {
    return {
      buffer: await pipeline.webp({ quality: 92 }).toBuffer(),
      mimeType: format.mimeType,
      extension: format.extension
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
    mimeType: format.mimeType,
    extension: format.extension
  };
}

async function writeTempFile(buffer, originalFilename) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drumbrooke-media-"));
  const filePath = path.join(directory, normalizeFilename(originalFilename));
  await fs.writeFile(filePath, buffer);
  return { directory, filePath };
}

async function cleanupTempDir(directory) {
  if (!directory) {
    return;
  }

  await fs.rm(directory, { recursive: true, force: true });
}

async function uploadToStorage(storagePath, buffer, mimeType) {
  const supabase = createSupabaseAdminClient();
  const bucket = getMediaBucketName();
  const result = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false
  });

  return assertSupabaseResult("upload_to_storage", result);
}

async function removeFromStorage(storagePath) {
  if (!storagePath) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const bucket = getMediaBucketName();
  const result = await supabase.storage.from(bucket).remove([storagePath]);

  if (result.error) {
    throw buildStructuredError("delete_storage_object", result.error);
  }
}

async function downloadFromStorage(storagePath) {
  const supabase = createSupabaseAdminClient();
  const bucket = getMediaBucketName();
  const result = await supabase.storage.from(bucket).download(storagePath);
  return assertSupabaseResult("download_storage_object", result);
}

export async function ingestUploadedMedia({
  buffer,
  mimeType,
  originalFilename,
  source = "upload",
  title,
  description,
  tags,
  featuredHome = false,
  homeSlot = null,
  manualRank = 0,
  workflowStatus = "approved",
  active = true
}) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw buildStructuredError("validate_file", new Error("Uploaded file buffer is empty."));
  }

  if (!mimeType || (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))) {
    throw buildStructuredError("validate_file", new Error(`Unsupported media type: ${mimeType || "unknown"}`));
  }

  const supabase = createSupabaseAdminClient();
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const storagePath = buildStoragePath({ source, filename: originalFilename });
  const ingestionLog = [
    createLogEntry("receive", "completed", {
      source,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: buffer.length
    })
  ];
  const processingLog = [];
  const errorLog = [];
  let insertedRow = null;
  let tempDirectory = null;

  try {
    await uploadToStorage(storagePath, buffer, mimeType);
    ingestionLog.push(createLogEntry("storage_upload", "completed", { storage_path: storagePath }));

    const publicUrl = usePublicMediaUrls()
      ? supabase.storage.from(getMediaBucketName()).getPublicUrl(storagePath).data.publicUrl
      : null;

    const insertResult = await supabase
      .from("media_assets")
      .insert({
        source,
        original_filename: originalFilename,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mimeType,
        file_size_bytes: buffer.length,
        checksum,
        title: title || stripExtension(originalFilename) || "Untitled asset",
        description: description || "",
        tags: tags || "",
        is_flagged: false,
        is_filtered: false,
        override_status: null,
        override_by: null,
        override_notes: null,
        workflow_status: workflowStatus,
        ingestion_log: ingestionLog,
        processing_log: processingLog,
        error_log: errorLog,
        is_hidden: false,
        hidden_at: null,
        hidden_reason: null,
        album_slugs: [],
        featured_home: featuredHome === true,
        home_slot: homeSlot == null ? null : Number(homeSlot),
        manual_rank: clampManualRank(manualRank, 0),
        is_active: active === true,
        views: 0,
        plays: 0,
        clicks: 0,
        thumbnail_storage_path: null,
        thumbnail_url: null,
        created_at: nowIso(),
        updated_at: nowIso()
      })
      .select("*")
      .single();

    insertedRow = assertSupabaseResult("insert_media_asset", insertResult);
    ingestionLog.push(createLogEntry("db_insert", "completed", { id: insertedRow.id }));

    const temp = await writeTempFile(buffer, originalFilename);
    tempDirectory = temp.directory;
    const metadata = await runProbe(temp.filePath);
    const filterConfig = await getMediaEngineConfig();
    const filterDecision = buildFilterDecision({
      asset: { originalFilename, title, description, tags },
      config: filterConfig
    });

    // Generate thumbnail (best-effort, never blocks ingestion)
    let thumbnailStoragePath = null;
    let thumbnailPublicUrl = null;
    const thumbBuffer = await generateThumbnailBuffer(buffer, mimeType, temp.filePath);
    if (thumbBuffer) {
      try {
        const thumbPath = buildStoragePath({ source, filename: originalFilename.replace(/\.[^.]+$/, "") + "_thumb.jpg" });
        await uploadToStorage(thumbPath, thumbBuffer, "image/jpeg");
        thumbnailStoragePath = thumbPath;
        thumbnailPublicUrl = usePublicMediaUrls()
          ? supabase.storage.from(getMediaBucketName()).getPublicUrl(thumbPath).data.publicUrl
          : null;
        ingestionLog.push(createLogEntry("thumbnail", "completed", { storage_path: thumbPath }));
      } catch {
        ingestionLog.push(createLogEntry("thumbnail", "skipped", { reason: "upload failed" }));
      }
    }

    const updatedRow = await writeMediaUpdate(insertedRow.id, {
      width: metadata.width,
      height: metadata.height,
      duration_ms: metadata.durationMs,
      is_flagged: filterDecision.is_flagged,
      is_filtered: filterDecision.is_filtered,
      filter_reason: filterDecision.filter_reason,
      filter_confidence: filterDecision.filter_confidence,
      thumbnail_storage_path: thumbnailStoragePath,
      thumbnail_url: thumbnailPublicUrl,
      ingestion_log: [...ingestionLog],
      processing_log: [
        ...processingLog,
        ...metadata.processingLog,
        createLogEntry("filter_config", "completed", filterConfig),
        ...filterDecision.processingLog
      ],
      error_log: [...errorLog]
    });

    return normalizeRow(updatedRow);
  } catch (error) {
    const failure = serializeError(error, error?.step || "ingestion");
    errorLog.push(createLogEntry(failure.step, "error", failure));

    if (insertedRow?.id) {
      try {
        await writeMediaUpdate(insertedRow.id, {
          error_log: [...errorLog],
          processing_log: [...processingLog],
          ingestion_log: [...ingestionLog]
        });
      } catch (updateError) {
        console.error("[media-engine] failed to persist ingestion error", updateError);
      }
    }

    throw buildStructuredError(failure.step, new Error(failure.message));
  } finally {
    await cleanupTempDir(tempDirectory);
  }
}

export async function importRemoteMedia({
  remoteUrl,
  source = "google_import",
  title,
  description,
  tags,
  featuredHome = false,
  homeSlot = null,
  manualRank = 0,
  workflowStatus = "approved",
  active = true
}) {
  let response;

  try {
    response = await fetch(remoteUrl, {
      method: "GET",
      cache: "no-store"
    });
  } catch (error) {
    throw buildStructuredError("remote_fetch", error);
  }

  if (!response.ok) {
    throw buildStructuredError("remote_fetch", new Error(`Remote fetch failed with status ${response.status}.`));
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const url = new URL(remoteUrl);
  const originalFilename = decodeURIComponent(url.pathname.split("/").pop() || "imported-asset");

  return ingestUploadedMedia({
    buffer: Buffer.from(arrayBuffer),
    mimeType,
    originalFilename,
    source,
    title,
    description,
    tags,
    featuredHome,
    homeSlot,
    manualRank,
    workflowStatus,
    active
  });
}

export async function getAdminMedia() {
  try {
    const rows = await listRows();
    const albumLookup = await getAlbumLookupForRows(rows);
    return Promise.all(rows.map((row) => normalizeRow(row, albumLookup)));
  } catch (error) {
    console.error("[media-engine] admin fallback", error);
    return fallbackMediaItems().items;
  }
}

export async function ensureMediaThumbnail(id) {
  const mediaId = String(id || "").trim();
  if (!mediaId) {
    throw buildStructuredError("ensure_media_thumbnail", new Error("Media id is required."));
  }

  const currentRow = await getMediaRowById(mediaId);
  const existingUrls = await resolveAssetUrls(currentRow);
  if (existingUrls.thumbnailUrl) {
    return existingUrls.thumbnailUrl;
  }

  if (!currentRow.storage_path) {
    return null;
  }

  let tempDirectory = null;

  try {
    const downloaded = await downloadFromStorage(currentRow.storage_path);
    const buffer = Buffer.from(await downloaded.arrayBuffer());
    const temp = await writeTempFile(buffer, currentRow.original_filename || `${mediaId}.bin`);
    tempDirectory = temp.directory;

    const thumbnailBuffer = await generateThumbnailBuffer(buffer, currentRow.mime_type || "", temp.filePath);
    if (!thumbnailBuffer) {
      return null;
    }

    const thumbnailStoragePath = buildStoragePath({
      source: currentRow.source || "upload",
      filename: `${stripExtension(currentRow.original_filename || mediaId)}-thumb.jpg`
    });

    await uploadToStorage(thumbnailStoragePath, thumbnailBuffer, "image/jpeg");

    const thumbnailUrl = usePublicMediaUrls()
      ? createSupabaseAdminClient().storage.from(getMediaBucketName()).getPublicUrl(thumbnailStoragePath).data.publicUrl
      : null;

    const processingLog = appendLog(currentRow.processing_log, createLogEntry("thumbnail_regenerated", "completed", {
      storage_path: thumbnailStoragePath
    }));

    const updatedRow = await writeMediaUpdate(mediaId, {
      thumbnail_storage_path: thumbnailStoragePath,
      thumbnail_url: thumbnailUrl,
      processing_log: processingLog
    });

    return (await resolveAssetUrls(updatedRow)).thumbnailUrl;
  } finally {
    await cleanupTempDir(tempDirectory);
  }
}

export async function getMediaThumbnailPlaceholderSvg(id) {
  const mediaId = String(id || "").trim();
  if (!mediaId) {
    throw buildStructuredError("get_media_thumbnail_placeholder", new Error("Media id is required."));
  }

  const currentRow = await getMediaRowById(mediaId);
  return buildVideoThumbnailSvg(currentRow.title || stripExtension(currentRow.original_filename) || "Video");
}

export async function getAdminAlbums() {
  try {
    const [rows, albumRows] = await Promise.all([listRows(), listAlbumRows()]);
    const albumLookup = buildAlbumLookup(albumRows, rows);
    return [...albumLookup.values()];
  } catch (error) {
    console.error("[media-engine] album fallback", error);
    return [];
  }
}

export async function createMediaAlbum(values) {
  const name = String(values.name || "").trim();
  if (!name) {
    throw buildStructuredError("create_media_album", new Error("Album name is required."));
  }

  const slug = sanitizePathSegment(values.slug || name);
  if (!slug) {
    throw buildStructuredError("create_media_album", new Error("Album slug is required."));
  }

  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("media_albums")
    .insert({
      name,
      slug,
      description: String(values.description || "").trim() || null,
      created_at: nowIso(),
      updated_at: nowIso()
    })
    .select("*")
    .single();

  return normalizeAlbumRow(assertSupabaseResult("insert_media_album", result));
}

function sortByHomepagePriority(items) {
  return [...items].sort((left, right) => {
    if (left.featuredHome !== right.featuredHome) {
      return left.featuredHome ? -1 : 1;
    }

    const leftSlot = left.homeSlot == null ? Number.MAX_SAFE_INTEGER : left.homeSlot;
    const rightSlot = right.homeSlot == null ? Number.MAX_SAFE_INTEGER : right.homeSlot;
    if (leftSlot !== rightSlot) {
      return leftSlot - rightSlot;
    }

    if ((left.manualRank || 0) !== (right.manualRank || 0)) {
      return (right.manualRank || 0) - (left.manualRank || 0);
    }

    if (left.smartScore !== right.smartScore) {
      return right.smartScore - left.smartScore;
    }

    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}

function compareByRecency(left, right) {
  return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
}

function compareBySpotlightPriority(left, right) {
  if (Boolean(left.spotlightHome) !== Boolean(right.spotlightHome)) {
    return left.spotlightHome ? -1 : 1;
  }

  if ((left.views || 0) !== (right.views || 0)) {
    return (right.views || 0) - (left.views || 0);
  }

  if ((left.plays || 0) !== (right.plays || 0)) {
    return (right.plays || 0) - (left.plays || 0);
  }

  if ((left.clicks || 0) !== (right.clicks || 0)) {
    return (right.clicks || 0) - (left.clicks || 0);
  }

  const leftSlot = left.homeSlot == null ? Number.MAX_SAFE_INTEGER : left.homeSlot;
  const rightSlot = right.homeSlot == null ? Number.MAX_SAFE_INTEGER : right.homeSlot;
  if (leftSlot !== rightSlot) {
    return leftSlot - rightSlot;
  }

  if ((left.manualRank || 0) !== (right.manualRank || 0)) {
    return (right.manualRank || 0) - (left.manualRank || 0);
  }

  if ((left.smartScore || 0) !== (right.smartScore || 0)) {
    return (right.smartScore || 0) - (left.smartScore || 0);
  }

  return compareByRecency(left, right);
}

function buildHomepageSelection(items) {
  const eligibleFeaturedItems = items.filter(
    (item) =>
      item.featuredHome === true &&
      item.active !== false &&
      item.isHidden !== true &&
      item.moderationStatus !== "rejected"
  );
  const orderedFeaturedItems = sortByHomepagePriority(eligibleFeaturedItems);
  const eligibleVideos = items.filter(
    (item) =>
      item.kind === "video" &&
      item.featuredHome === true &&
      item.active !== false &&
      item.isHidden !== true &&
      item.moderationStatus !== "rejected"
  );
  const explicitSpotlight = [...eligibleFeaturedItems]
    .filter((item) => item.spotlightHome === true)
    .sort(compareBySpotlightPriority)[0] || null;
  const fallbackSpotlight = explicitSpotlight || [...eligibleVideos].sort(compareBySpotlightPriority)[0] || orderedFeaturedItems[0] || null;
  const rotationVideos = sortByHomepagePriority(
    eligibleVideos.filter((item) => item.id !== fallbackSpotlight?.id)
  );
  const featuredImages = sortByHomepagePriority(
    items.filter(
      (item) =>
        item.kind === "image" &&
        item.featuredHome === true &&
        item.active !== false &&
        item.isHidden !== true &&
        item.moderationStatus !== "rejected"
    )
  );

  return {
    spotlightItem: fallbackSpotlight,
    heroVideo: fallbackSpotlight?.kind === "video" ? fallbackSpotlight : rotationVideos[0] || null,
    secondaryVideo: fallbackSpotlight?.kind === "video" ? rotationVideos[0] || null : rotationVideos[1] || null,
    tertiaryVideo: fallbackSpotlight?.kind === "video" ? rotationVideos[1] || null : rotationVideos[2] || null,
    backgroundVideos: (fallbackSpotlight?.kind === "video" ? rotationVideos.slice(2, 5) : rotationVideos.slice(3, 6)),
    featuredVideos: fallbackSpotlight?.kind === "video"
      ? [fallbackSpotlight, ...rotationVideos]
      : rotationVideos,
    featuredImages: featuredImages.slice(0, 8),
    galleryImages: featuredImages.slice(0, 8)
  };
}

function fallbackMediaItems() {
  const items = [
    ...siteData.mediaGallery.map((item, index) => ({
      id: `static-image-${index}`,
      source: "static",
      title: item.tag,
      description: item.alt,
      tags: item.tag,
      originalFilename: item.src.split("/").pop(),
      storagePath: item.src,
      publicUrl: item.src,
      url: item.src,
      playbackUrl: null,
      thumbnailUrl: item.src,
      posterUrl: item.src,
      thumbnailStoragePath: null,
      mimeType: "image/jpeg",
      kind: "image",
      fileSizeBytes: null,
      byteSize: null,
      width: null,
      height: null,
      durationMs: null,
      durationSeconds: null,
      checksum: null,
      isFlagged: false,
      isFiltered: false,
      filterReason: "",
      filterConfidence: null,
      overrideStatus: null,
      overrideBy: null,
      overrideNotes: "",
      workflowStatus: "approved",
      moderationStatus: "approved",
      ingestionLog: [createLogEntry("fallback", "completed")],
      processingLog: [],
      errorLog: [],
      isHidden: false,
      hiddenAt: null,
      hiddenReason: "",
      albumSlugs: [],
      albumNames: [],
      albums: [],
      featuredHome: true,
      homeSlot: index + 1,
      spotlightHome: false,
      manualRank: 0,
      clipStartSeconds: 0,
      clipEndSeconds: null,
      active: true,
      views: 0,
      plays: 0,
      clicks: 0,
      provider: "static",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      smartScore: 200
    })),
    ...siteData.featuredVideos.map((item, index) => ({
      id: `static-video-${index}`,
      source: "static",
      title: item.title,
      description: item.description,
      tags: item.tags || "featured",
      originalFilename: `${sanitizePathSegment(item.title)}.txt`,
      storagePath: item.href,
      publicUrl: item.href,
      url: item.href,
      playbackUrl: item.playbackUrl || item.href,
      thumbnailUrl: item.poster || siteData.mediaGallery[index]?.src || siteData.mediaGallery[0]?.src || null,
      posterUrl: item.poster || siteData.mediaGallery[index]?.src || siteData.mediaGallery[0]?.src || null,
      thumbnailStoragePath: null,
      mimeType: "video/mp4",
      kind: "video",
      fileSizeBytes: null,
      byteSize: null,
      width: null,
      height: null,
      durationMs: null,
      durationSeconds: null,
      checksum: null,
      isFlagged: false,
      isFiltered: false,
      filterReason: "",
      filterConfidence: null,
      overrideStatus: null,
      overrideBy: null,
      overrideNotes: "",
      workflowStatus: "approved",
      moderationStatus: "approved",
      ingestionLog: [createLogEntry("fallback", "completed")],
      processingLog: [],
      errorLog: [],
      isHidden: false,
      hiddenAt: null,
      hiddenReason: "",
      featuredHome: true,
      homeSlot: index + 1,
      spotlightHome: index === 0,
      manualRank: 0,
      clipStartSeconds: 0,
      clipEndSeconds: null,
      active: true,
      views: 0,
      plays: 0,
      clicks: 0,
      provider: "static",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      smartScore: 200
    }))
  ];

  return {
    items,
    images: items.filter((item) => item.kind === "image"),
    videos: items.filter((item) => item.kind === "video"),
    home: buildHomepageSelection(items)
  };
}

export async function getHomepageMedia() {
  try {
    const items = await getAdminMedia();
    if (!items.length) {
      return fallbackMediaItems();
    }

    return {
      items,
      images: items.filter((item) => item.kind === "image"),
      videos: items.filter((item) => item.kind === "video"),
      home: buildHomepageSelection(items)
    };
  } catch (error) {
    console.error("[media-engine] homepage fallback", error);
    return fallbackMediaItems();
  }
}

export async function getDashboardSummary() {
  const items = await getAdminMedia();
  const activeItems = items.filter((item) => item.active !== false);
  const approvedItems = items.filter((item) => item.moderationStatus === "approved");
  const topItems = sortByHomepagePriority(activeItems.filter((item) => item.isHidden !== true)).slice(0, 6);

  return {
    activeCount: activeItems.length,
    approvedCount: approvedItems.length,
    reviewCount: items.filter((item) => item.moderationStatus === "review" || item.moderationStatus === "pending").length,
    rejectedCount: items.filter((item) => item.moderationStatus === "rejected").length,
    featuredCount: items.filter((item) => item.featuredHome).length,
    hiddenCount: items.filter((item) => item.isHidden).length,
    albumCount: new Set(items.flatMap((item) => item.albumSlugs || [])).size,
    totalViews: items.reduce((total, item) => total + (item.views || 0), 0),
    totalPlays: items.reduce((total, item) => total + (item.plays || 0), 0),
    totalClicks: items.reduce((total, item) => total + (item.clicks || 0), 0),
    flaggedCount: items.filter((item) => item.isFlagged).length,
    filteredCount: items.filter((item) => item.isFiltered).length,
    topItems
  };
}

export async function updateMediaAsset(values) {
  const id = String(values.id || "").trim();
  if (!id) {
    throw buildStructuredError("update_media_asset", new Error("Media id is required."));
  }

  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(values, key);
  const currentRows = await listRows();
  const currentRow = currentRows.find((row) => row.id === id);
  if (!currentRow) {
    throw buildStructuredError("update_media_asset", new Error("Media asset not found."));
  }

  const currentTitle = currentRow.title || stripExtension(currentRow.original_filename) || "Untitled asset";
  const currentPlaybackSettings = getPlaybackSettingsFromLog(currentRow);
  const nextAlbumSlugs = hasOwn("albumSlugs")
    ? Array.from(new Set(toStringArray(values.albumSlugs).map((value) => sanitizePathSegment(value)).filter(Boolean)))
    : toStringArray(currentRow.album_slugs).map((value) => sanitizePathSegment(value));
  const nextHidden = hasOwn("isHidden") ? values.isHidden === true : currentRow.is_hidden === true;
  const nextHiddenReason =
    nextHidden === true
      ? hasOwn("hiddenReason")
        ? String(values.hiddenReason || "").trim() || null
        : currentRow.hidden_reason || null
      : null;
  const nextHiddenAt =
    nextHidden === true
      ? currentRow.is_hidden === true
        ? currentRow.hidden_at || nowIso()
        : nowIso()
      : null;
  const nextSpotlight = hasOwn("spotlightHome")
    ? values.spotlightHome === true
    : isExplicitSpotlightSlot(currentRow.home_slot);
  const nextClipSettings = sanitizeClipRange(
    {
      clipStartSeconds: hasOwn("clipStartSeconds") ? values.clipStartSeconds : currentPlaybackSettings.clipStartSeconds,
      clipEndSeconds: hasOwn("clipEndSeconds") ? values.clipEndSeconds : currentPlaybackSettings.clipEndSeconds
    },
    currentRow.duration_ms == null ? null : Math.round(Number(currentRow.duration_ms) / 1000)
  );

  const payload = {
    title: hasOwn("title") ? String(values.title || "Untitled asset").trim() : currentTitle,
    description: hasOwn("description") ? String(values.description || "").trim() : currentRow.description || "",
    tags: hasOwn("tags") ? String(values.tags || "").trim() : currentRow.tags || "",
    workflow_status: hasOwn("moderationStatus") || hasOwn("workflowStatus")
      ? String(values.moderationStatus || values.workflowStatus || "approved").trim().toLowerCase()
      : currentRow.workflow_status || "approved",
    override_status: hasOwn("overrideStatus")
      ? String(values.overrideStatus || "").trim().toLowerCase() || null
      : currentRow.override_status || null,
    override_by: hasOwn("overrideBy") ? String(values.overrideBy || "").trim() || null : currentRow.override_by || null,
    override_notes: hasOwn("overrideNotes")
      ? String(values.overrideNotes || "").trim() || null
      : currentRow.override_notes || null,
    featured_home: nextSpotlight === true
      ? true
      : hasOwn("featuredHome")
        ? values.featuredHome === true
        : currentRow.featured_home === true,
    home_slot: nextSpotlight === true
      ? 0
      : hasOwn("homeSlot")
        ? String(values.homeSlot || "").trim()
          ? Number(values.homeSlot)
          : null
        : currentRow.home_slot == null
          ? null
          : isExplicitSpotlightSlot(currentRow.home_slot)
            ? null
            : Number(currentRow.home_slot),
    manual_rank: hasOwn("manualRankDelta")
      ? clampManualRank(Number(currentRow.manual_rank || 0) + Number(values.manualRankDelta || 0), clampManualRank(currentRow.manual_rank, 0))
      : hasOwn("manualRank")
        ? clampManualRank(values.manualRank, clampManualRank(currentRow.manual_rank, 0))
        : clampManualRank(currentRow.manual_rank, 0),
    is_active: hasOwn("active") ? values.active === true : currentRow.is_active === true,
    is_hidden: nextHidden,
    hidden_at: nextHiddenAt,
    hidden_reason: nextHiddenReason,
    album_slugs: nextAlbumSlugs,
    ingestion_log: undefined,
    processing_log: undefined,
    error_log: undefined
  };

  const processingLog = appendLog(currentRow.processing_log, createLogEntry("manual_update", "completed", {
    fields: {
      title: payload.title,
      workflow_status: payload.workflow_status,
      override_status: payload.override_status,
      featured_home: payload.featured_home,
      spotlight_home: nextSpotlight,
      home_slot: payload.home_slot,
      manual_rank: payload.manual_rank,
      clip_start_seconds: nextClipSettings.clipStartSeconds,
      clip_end_seconds: nextClipSettings.clipEndSeconds,
      is_active: payload.is_active,
      is_hidden: payload.is_hidden,
      hidden_reason: payload.hidden_reason,
      album_slugs: payload.album_slugs
    }
  }));

  if (payload.home_slot === 0) {
    const supabase = createSupabaseAdminClient();
    const existingSpotlightIds = currentRows
      .filter((row) => row.id !== id && isExplicitSpotlightSlot(row.home_slot))
      .map((row) => row.id);

    if (existingSpotlightIds.length) {
      const result = await supabase
        .from("media_assets")
        .update({ home_slot: null, updated_at: nowIso() })
        .in("id", existingSpotlightIds);

      assertSupabaseResult("clear_existing_spotlight", result);
    }
  }

  const updated = await writeMediaUpdate(id, {
    ...payload,
    processing_log: processingLog
  });

  return normalizeRow(updated);
}

export async function applyMediaEdits(values) {
  const mediaId = String(values.id || "").trim();
  if (!mediaId) {
    throw buildStructuredError("apply_media_edits", new Error("Media id is required."));
  }

  const currentRow = await getMediaRowById(mediaId);
  const mimeType = String(currentRow.mime_type || "");
  const isVideo = mimeType.startsWith("video/");
  const isImage = mimeType.startsWith("image/");

  if (!isVideo && !isImage) {
    throw buildStructuredError("apply_media_edits", new Error("Only video and image assets can be edited."));
  }

  const durationSeconds = currentRow.duration_ms == null ? null : Math.max(0, Math.round(Number(currentRow.duration_ms) / 1000));
  const trimSettings = sanitizeClipRange(
    {
      clipStartSeconds: values.trimStartSeconds,
      clipEndSeconds: values.trimEndSeconds
    },
    durationSeconds
  );
  const muteAudio = values.muteAudio === true;
  const rotateDegrees = clampEditorNumber(values.rotateDegrees, 0, 270, 0);
  const brightness = clampEditorNumber(values.brightness, 0.5, 1.5, 1);
  const contrast = clampEditorNumber(values.contrast, 0.5, 1.8, 1);
  const saturation = clampEditorNumber(values.saturation, 0, 2, 1);

  const hasVideoEdit = isVideo && (
    trimSettings.clipStartSeconds > 0 ||
    trimSettings.clipEndSeconds != null ||
    muteAudio
  );
  const hasImageEdit = isImage && (
    rotateDegrees !== 0 ||
    Math.abs(brightness - 1) > 0.001 ||
    Math.abs(contrast - 1) > 0.001 ||
    Math.abs(saturation - 1) > 0.001
  );

  if (!hasVideoEdit && !hasImageEdit) {
    throw buildStructuredError("apply_media_edits", new Error("Pick at least one edit before saving."));
  }

  let tempDirectory = null;
  const uploadedPaths = [];

  try {
    const downloaded = await downloadFromStorage(currentRow.storage_path);
    const inputBuffer = Buffer.from(await downloaded.arrayBuffer());
    const temp = await writeTempFile(inputBuffer, currentRow.original_filename || `${mediaId}.bin`);
    tempDirectory = temp.directory;

    const outputBase = `${stripExtension(currentRow.original_filename || mediaId)}-edited`;
    let editedBuffer = inputBuffer;
    let nextMimeType = mimeType;
    let nextExtension = path.extname(currentRow.original_filename || "") || (isVideo ? ".mp4" : ".jpg");
    let outputPath = temp.filePath;
    let metadata = { width: null, height: null, durationMs: null, processingLog: [] };

    if (isVideo) {
      outputPath = path.join(tempDirectory, `${sanitizePathSegment(outputBase) || mediaId}.mp4`);
      editedBuffer = await buildEditedVideoBuffer({
        inputPath: temp.filePath,
        outputPath,
        trimStartSeconds: trimSettings.clipStartSeconds,
        trimEndSeconds: trimSettings.clipEndSeconds,
        muteAudio
      });
      nextMimeType = "video/mp4";
      nextExtension = ".mp4";
      metadata = await runProbe(outputPath);
    } else {
      const imageResult = await buildEditedImageBuffer({
        buffer: inputBuffer,
        mimeType,
        rotateDegrees,
        brightness,
        contrast,
        saturation
      });
      editedBuffer = imageResult.buffer;
      nextMimeType = imageResult.mimeType;
      nextExtension = imageResult.extension;
      outputPath = path.join(tempDirectory, `${sanitizePathSegment(outputBase) || mediaId}${nextExtension}`);
      await fs.writeFile(outputPath, editedBuffer);
      const imageMetadata = await sharp(editedBuffer, { failOn: "none" }).metadata();
      metadata = {
        width: imageMetadata.width == null ? null : Number(imageMetadata.width),
        height: imageMetadata.height == null ? null : Number(imageMetadata.height),
        durationMs: null,
        processingLog: [
          createLogEntry("image_edit_probe", "completed", {
            width: imageMetadata.width || null,
            height: imageMetadata.height || null
          })
        ]
      };
    }

    const nextFilename = `${outputBase}${nextExtension}`;
    const nextStoragePath = buildStoragePath({
      source: currentRow.source || "upload",
      filename: nextFilename
    });

    await uploadToStorage(nextStoragePath, editedBuffer, nextMimeType);
    uploadedPaths.push(nextStoragePath);

    const nextPublicUrl = usePublicMediaUrls()
      ? createSupabaseAdminClient().storage.from(getMediaBucketName()).getPublicUrl(nextStoragePath).data.publicUrl
      : null;

    let nextThumbnailStoragePath = null;
    let nextThumbnailUrl = null;
    let thumbnailLogEntry = createLogEntry("editor_thumbnail", "skipped", { reason: "thumbnail generation unavailable" });

    try {
      const thumbnailBuffer = await generateThumbnailBuffer(editedBuffer, nextMimeType, outputPath);
      if (thumbnailBuffer?.length) {
        nextThumbnailStoragePath = buildStoragePath({
          source: currentRow.source || "upload",
          filename: `${outputBase}-thumb.jpg`
        });
        await uploadToStorage(nextThumbnailStoragePath, thumbnailBuffer, "image/jpeg");
        uploadedPaths.push(nextThumbnailStoragePath);
        nextThumbnailUrl = usePublicMediaUrls()
          ? createSupabaseAdminClient().storage.from(getMediaBucketName()).getPublicUrl(nextThumbnailStoragePath).data.publicUrl
          : null;
        thumbnailLogEntry = createLogEntry("editor_thumbnail", "completed", {
          storage_path: nextThumbnailStoragePath
        });
      }
    } catch (thumbnailError) {
      thumbnailLogEntry = createLogEntry("editor_thumbnail", "skipped", {
        reason: thumbnailError instanceof Error ? thumbnailError.message : "thumbnail generation failed"
      });
    }

    const editDetail = isVideo
      ? {
          kind: "video",
          trim_start_seconds: trimSettings.clipStartSeconds,
          trim_end_seconds: trimSettings.clipEndSeconds,
          mute_audio: muteAudio
        }
      : {
          kind: "image",
          rotate_degrees: rotateDegrees,
          brightness,
          contrast,
          saturation
        };

    const processingLog = [
      ...toJsonArray(currentRow.processing_log),
      createLogEntry("asset_edit", "completed", {
        ...editDetail,
        storage_path: nextStoragePath,
        mime_type: nextMimeType,
        file_size_bytes: editedBuffer.length
      }),
      ...toJsonArray(metadata.processingLog),
      thumbnailLogEntry,
      createLogEntry("manual_update", "completed", {
        fields: {
          clip_start_seconds: 0,
          clip_end_seconds: null
        }
      })
    ];

    const updatedRow = await writeMediaUpdate(mediaId, {
      original_filename: nextFilename,
      storage_path: nextStoragePath,
      public_url: nextPublicUrl,
      mime_type: nextMimeType,
      file_size_bytes: editedBuffer.length,
      checksum: crypto.createHash("sha256").update(editedBuffer).digest("hex"),
      width: metadata.width,
      height: metadata.height,
      duration_ms: metadata.durationMs,
      thumbnail_storage_path: nextThumbnailStoragePath,
      thumbnail_url: nextThumbnailUrl,
      processing_log: processingLog
    });

    await removeFromStorage(currentRow.storage_path).catch(() => {});
    if (currentRow.thumbnail_storage_path) {
      await removeFromStorage(currentRow.thumbnail_storage_path).catch(() => {});
    }

    return normalizeRow(updatedRow);
  } catch (error) {
    await Promise.all(uploadedPaths.map((entry) => removeFromStorage(entry).catch(() => {})));
    throw buildStructuredError(error?.step || "apply_media_edits", error instanceof Error ? error : new Error(String(error || "Media edit failed.")));
  } finally {
    await cleanupTempDir(tempDirectory);
  }
}

export async function deleteMediaAsset(id) {
  const mediaId = String(id || "").trim();
  if (!mediaId) {
    throw buildStructuredError("delete_media_asset", new Error("Media id is required."));
  }

  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", mediaId)
    .single();

  const row = assertSupabaseResult("select_media_asset_for_delete", result);

  await removeFromStorage(row.storage_path);
  if (row.thumbnail_storage_path) {
    await removeFromStorage(row.thumbnail_storage_path);
  }

  const deleted = await supabase.from("media_assets").delete().eq("id", mediaId);
  assertSupabaseResult("delete_media_asset", deleted);
}

export async function trackInteraction({ type, mediaId, mediaIds }) {
  const supabase = createSupabaseAdminClient();
  const ids = Array.isArray(mediaIds) && mediaIds.length ? mediaIds : mediaId ? [mediaId] : [];

  for (const id of ids) {
    const result = await supabase.from("media_assets").select("views, plays, clicks").eq("id", id).single();
    const row = assertSupabaseResult("select_media_asset_for_tracking", result);

    const next = {
      views: row.views,
      plays: row.plays,
      clicks: row.clicks
    };

    if (type === "page_view") {
      next.views = Number(row.views || 0) + 1;
    }

    if (type === "video_play") {
      next.plays = Number(row.plays || 0) + 1;
    }

    if (type === "link_click") {
      next.clicks = Number(row.clicks || 0) + 1;
    }

    await writeMediaUpdate(id, next);
  }
}
