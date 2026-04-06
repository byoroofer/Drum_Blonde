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

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
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
  // Only resolve a thumbnail if there is a dedicated thumbnail path/url — never fall back to the media file itself
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

function getEffectiveStatus(row) {
  return row.override_status || row.workflow_status || "approved";
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
    thumbnailUrl: urls.thumbnailUrl,
    posterUrl: urls.posterUrl,
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
    manualRank: row.manual_rank == null ? 0 : Number(row.manual_rank),
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
      const frameOut = tempFilePath + "_thumb.jpg";
      await new Promise((resolve, reject) => {
        const child = spawn(ffmpegStatic, [
          "-ss", "00:00:01",
          "-i", tempFilePath,
          "-frames:v", "1",
          "-q:v", "3",
          "-y", frameOut
        ]);
        child.on("error", reject);
        child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
      });
      const frameBuffer = await fs.readFile(frameOut);
      await fs.unlink(frameOut).catch(() => {});
      return await sharp(frameBuffer).resize(600, null, { withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    }
  } catch {
    // Thumbnail generation is best-effort — never block ingestion
  }
  return null;
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
        manual_rank: Number(manualRank || 0),
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

    if (left.smartScore !== right.smartScore) {
      return right.smartScore - left.smartScore;
    }

    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}

function buildHomepageSelection(items) {
  const eligibleVideos = sortByHomepagePriority(
    items.filter(
      (item) =>
        item.kind === "video" &&
        item.active !== false &&
        item.isHidden !== true &&
        item.moderationStatus !== "rejected"
    )
  );
  const featuredImages = sortByHomepagePriority(
    items.filter((item) => item.kind === "image" && item.active !== false && item.isHidden !== true)
  ).slice(0, 8);

  return {
    heroVideo: eligibleVideos[0] || null,
    secondaryVideo: eligibleVideos[1] || null,
    tertiaryVideo: eligibleVideos[2] || null,
    backgroundVideos: eligibleVideos.slice(3, 6),
    featuredVideos: eligibleVideos.slice(0, 6),
    featuredImages,
    galleryImages: featuredImages
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
      manualRank: 0,
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
      manualRank: 0,
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
    featured_home: hasOwn("featuredHome") ? values.featuredHome === true : currentRow.featured_home === true,
    home_slot: hasOwn("homeSlot")
      ? String(values.homeSlot || "").trim()
        ? Number(values.homeSlot)
        : null
      : currentRow.home_slot == null
        ? null
        : Number(currentRow.home_slot),
    manual_rank: hasOwn("manualRank") ? Number(values.manualRank || 0) : Number(currentRow.manual_rank || 0),
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
      home_slot: payload.home_slot,
      manual_rank: payload.manual_rank,
      is_active: payload.is_active,
      is_hidden: payload.is_hidden,
      hidden_reason: payload.hidden_reason,
      album_slugs: payload.album_slugs
    }
  }));

  const updated = await writeMediaUpdate(id, {
    ...payload,
    processing_log: processingLog
  });

  return normalizeRow(updated);
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



