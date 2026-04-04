import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import {
  buildStorageRequirements,
  getPlatformConfig,
  hasBlobStore,
  hasDatabase
} from "@/lib/env";
import { ingestUploadedMedia } from "@/lib/media-repo";

const GOOGLE_PHOTOS_API_BASE = "https://photoslibrary.googleapis.com/v1";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const OPENAI_MODERATIONS_ENDPOINT = "https://api.openai.com/v1/moderations";
const FETCH_TIMEOUT_MS = 30_000;
const MODERATION_TIMEOUT_MS = 45_000;
const DEFAULT_QUERY = "brooke";
const DEFAULT_MAX_ITEMS = 20;
const MAX_DURATION_SECONDS = 120;
const MODERATION_MODEL = "omni-moderation-latest";
const MAX_NOTE_LENGTH = 1500;
const MAX_CATEGORY_LENGTH = 300;

let cachedGooglePhotosToken = null;
let cachedGooglePhotosTokenExpiresAt = 0;

class ImportPipelineError extends Error {
  constructor(message, { stage = "unknown", code = "unexpected", retriable = false, cause = null } = {}) {
    super(message);
    this.name = "ImportPipelineError";
    this.stage = stage;
    this.code = code;
    this.retriable = retriable;
    this.cause = cause;
  }
}

function sanitizePathSegment(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function shorten(value, maxLength = MAX_NOTE_LENGTH) {
  return String(value || "").trim().slice(0, maxLength);
}

function joinSummaryText(parts, maxLength = MAX_NOTE_LENGTH) {
  return shorten(
    parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" "),
    maxLength
  );
}

function formatDurationLabel(durationSeconds) {
  const roundedSeconds = Math.max(0, Math.round(Number(durationSeconds) || 0));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatModerationCategories(categories = {}) {
  return Array.from(
    new Set(
      Object.entries(categories)
        .filter(([, isFlagged]) => Boolean(isFlagged))
        .map(([name]) => name)
    )
  )
    .join(", ")
    .slice(0, MAX_CATEGORY_LENGTH);
}

function normalizeImportError(error, fallbackStage = "unknown") {
  if (error instanceof ImportPipelineError) {
    return {
      stage: error.stage,
      code: error.code,
      message: error.message,
      retriable: error.retriable
    };
  }

  if (error instanceof Error) {
    return {
      stage: fallbackStage,
      code: "unexpected",
      message: error.message,
      retriable: false
    };
  }

  return {
    stage: fallbackStage,
    code: "unexpected",
    message: String(error || "Import failed."),
    retriable: false
  };
}

function buildGooglePhotosAuthError() {
  return new ImportPipelineError(
    "Google Photos is not configured. Add GOOGLE_PHOTOS_ACCESS_TOKEN or GOOGLE_PHOTOS_REFRESH_TOKEN plus GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    {
      stage: "auth",
      code: "google_photos_not_configured"
    }
  );
}

function buildVideoDownloadUrl(baseUrl) {
  return `${baseUrl}=dv`;
}

function buildThumbnailUrl(baseUrl) {
  return `${baseUrl}=w1280-h1280`;
}

function getExtensionFromMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized === "video/quicktime") {
    return ".mov";
  }

  if (normalized === "video/webm") {
    return ".webm";
  }

  if (normalized === "video/x-matroska") {
    return ".mkv";
  }

  if (normalized === "video/avi" || normalized === "video/x-msvideo") {
    return ".avi";
  }

  return ".mp4";
}

async function fetchWithTimeout(url, options, { stage, code, timeoutMs = FETCH_TIMEOUT_MS, retriable = true } = {}) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ImportPipelineError(message.includes("aborted") ? "Request timed out." : message, {
      stage,
      code,
      retriable,
      cause: error
    });
  }
}

async function getGooglePhotosAccessToken(forceRefresh = false) {
  const config = getPlatformConfig();

  if (!forceRefresh && config.googlePhotosAccessToken) {
    return config.googlePhotosAccessToken;
  }

  if (!forceRefresh && cachedGooglePhotosToken && Date.now() < cachedGooglePhotosTokenExpiresAt) {
    return cachedGooglePhotosToken;
  }

  if (
    !config.googlePhotosRefreshToken ||
    !config.googleOauthClientId ||
    !config.googleOauthClientSecret
  ) {
    if (config.googlePhotosAccessToken) {
      throw new ImportPipelineError(
        "Google Photos access token expired and no refresh credentials are configured.",
        {
          stage: "auth",
          code: "token_refresh_unavailable"
        }
      );
    }

    throw buildGooglePhotosAuthError();
  }

  const body = new URLSearchParams({
    client_id: config.googleOauthClientId,
    client_secret: config.googleOauthClientSecret,
    refresh_token: config.googlePhotosRefreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetchWithTimeout(
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    {
      stage: "auth",
      code: "token_refresh_failed"
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new ImportPipelineError(
      `Google OAuth token refresh failed (${response.status}): ${shorten(errorText, 400)}`,
      {
        stage: "auth",
        code: "token_refresh_failed"
      }
    );
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new ImportPipelineError("Google OAuth token refresh did not return an access token.", {
      stage: "auth",
      code: "missing_access_token"
    });
  }

  cachedGooglePhotosToken = payload.access_token;
  cachedGooglePhotosTokenExpiresAt = Date.now() + Math.max(Number(payload.expires_in || 3600) - 60, 60) * 1000;
  return cachedGooglePhotosToken;
}

async function googlePhotosRequest(endpoint, { method = "GET", body, token } = {}) {
  const initialToken = token || (await getGooglePhotosAccessToken());

  async function performRequest(accessToken, hasRetried = false) {
    const response = await fetchWithTimeout(
      `${GOOGLE_PHOTOS_API_BASE}${endpoint}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      },
      {
        stage: "search",
        code: "google_photos_request_failed"
      }
    );

    if (response.status === 401 && !hasRetried) {
      const refreshedToken = await getGooglePhotosAccessToken(true);
      return performRequest(refreshedToken, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new ImportPipelineError(
        `Google Photos request failed (${response.status}): ${shorten(errorText, 400)}`,
        {
          stage: "search",
          code: "google_photos_request_failed"
        }
      );
    }

    return response.json();
  }

  return performRequest(initialToken);
}

function normalizeCandidate(item, albumId) {
  return {
    externalId: item.id,
    albumId: albumId || null,
    title: item.description || stripExtension(item.filename) || "Google Photos video",
    description: item.description || "",
    filename: item.filename || `${item.id}.mp4`,
    mimeType: item.mimeType || "video/mp4",
    sourceCreatedAt: item.mediaMetadata?.creationTime || null,
    productUrl: item.productUrl || "",
    downloadUrl: item.baseUrl ? buildVideoDownloadUrl(item.baseUrl) : "",
    thumbnailUrl: item.baseUrl ? buildThumbnailUrl(item.baseUrl) : "",
    processingStatus: item.mediaMetadata?.video?.status || ""
  };
}

function matchesFilenameQuery(candidate, filenameQuery) {
  if (!filenameQuery) {
    return true;
  }

  const haystack = [candidate.filename, candidate.title, candidate.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(filenameQuery.trim().toLowerCase());
}

async function searchGooglePhotosVideoCandidates({
  albumId,
  filenameQuery = DEFAULT_QUERY,
  maxItems = DEFAULT_MAX_ITEMS
}) {
  const sanitizedLimit = Math.max(1, Math.min(Number(maxItems) || DEFAULT_MAX_ITEMS, 50));
  const results = [];
  let pageToken = null;
  const diagnostics = {
    pagesFetched: 0,
    apiItemsSeen: 0,
    skippedNonVideo: 0,
    skippedProcessing: 0,
    skippedQuery: 0
  };

  do {
    const requestBody = {
      pageSize: Math.min(100, Math.max(sanitizedLimit * 2, 25)),
      pageToken
    };

    if (albumId) {
      requestBody.albumId = albumId;
    } else {
      requestBody.filters = {
        mediaTypeFilter: {
          mediaTypes: ["VIDEO"]
        },
        includeArchivedMedia: false
      };
    }

    const payload = await googlePhotosRequest("/mediaItems:search", {
      method: "POST",
      body: requestBody
    });

    diagnostics.pagesFetched += 1;

    for (const item of payload.mediaItems || []) {
      diagnostics.apiItemsSeen += 1;
      const candidate = normalizeCandidate(item, albumId);
      if (!candidate.mimeType.startsWith("video/")) {
        diagnostics.skippedNonVideo += 1;
        continue;
      }

      if (candidate.processingStatus && candidate.processingStatus !== "READY") {
        diagnostics.skippedProcessing += 1;
        continue;
      }

      if (!matchesFilenameQuery(candidate, filenameQuery)) {
        diagnostics.skippedQuery += 1;
        continue;
      }

      results.push(candidate);
      if (results.length >= sanitizedLimit) {
        break;
      }
    }

    pageToken = payload.nextPageToken || null;
  } while (pageToken && results.length < sanitizedLimit);

  return {
    candidates: results,
    diagnostics
  };
}

export async function listGooglePhotosVideoCandidates(options) {
  const { candidates, diagnostics } = await searchGooglePhotosVideoCandidates(options);
  return {
    candidates,
    diagnostics
  };
}

async function downloadCandidateVideo(candidate, destinationFilePath) {
  if (!candidate.downloadUrl) {
    throw new ImportPipelineError("Google Photos did not return a downloadable video URL for this item.", {
      stage: "download",
      code: "missing_download_url"
    });
  }

  const initialToken = await getGooglePhotosAccessToken();

  async function performDownload(accessToken, hasRetried = false) {
    const response = await fetchWithTimeout(
      candidate.downloadUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      {
        stage: "download",
        code: "download_failed"
      }
    );

    if (response.status === 401 && !hasRetried) {
      const refreshedToken = await getGooglePhotosAccessToken(true);
      return performDownload(refreshedToken, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new ImportPipelineError(
        `Google Photos download failed (${response.status}): ${shorten(errorText, 400)}`,
        {
          stage: "download",
          code: "download_failed"
        }
      );
    }

    if (response.body) {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationFilePath));
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destinationFilePath, buffer);
  }

  await performDownload(initialToken);
}

function runBinary(binaryPath, args, stage) {
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    const child = spawn(binaryPath, args, {
      windowsHide: true
    });

    child.stdout.on("data", (chunk) => {
      stdout.push(Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderr.push(Buffer.from(chunk));
    });

    child.on("error", (error) => {
      reject(
        new ImportPipelineError(error.message, {
          stage,
          code: "binary_spawn_failed",
          cause: error
        })
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new ImportPipelineError(
            `${path.basename(binaryPath)} exited with code ${code}: ${shorten(Buffer.concat(stderr).toString("utf8"), 500)}`,
            {
              stage,
              code: "binary_failed"
            }
          )
        );
        return;
      }

      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

async function getVideoDurationData(filePath) {
  const binaryPath = ffprobe?.path;
  if (!binaryPath) {
    throw new ImportPipelineError("ffprobe-static is not available.", {
      stage: "probe",
      code: "ffprobe_missing"
    });
  }

  const output = await runBinary(
    binaryPath,
    ["-v", "quiet", "-print_format", "json", "-show_entries", "format=duration", filePath],
    "probe"
  );

  let payload;
  try {
    payload = JSON.parse(output);
  } catch (error) {
    throw new ImportPipelineError("ffprobe returned invalid JSON output.", {
      stage: "probe",
      code: "invalid_ffprobe_output",
      cause: error
    });
  }

  const exactSeconds = Number(payload?.format?.duration || 0);
  if (!exactSeconds || Number.isNaN(exactSeconds)) {
    throw new ImportPipelineError("Could not determine video duration.", {
      stage: "probe",
      code: "missing_duration"
    });
  }

  return {
    exactSeconds,
    roundedSeconds: Math.max(1, Math.round(exactSeconds))
  };
}

function buildFrameTimestamps(durationSeconds) {
  const safeDuration = Math.max(1, Math.round(Number(durationSeconds) || 1));
  const candidates = [
    1,
    Math.floor(safeDuration * 0.2),
    Math.floor(safeDuration * 0.5),
    Math.floor(safeDuration * 0.8)
  ];

  return [
    ...new Set(
      candidates
        .filter((value) => value > 0)
        .map((value) => Math.min(value, Math.max(safeDuration - 1, 1)))
    )
  ];
}

async function extractReviewFrames(filePath, durationSeconds, outputDirectory) {
  if (!ffmpegPath) {
    throw new ImportPipelineError("ffmpeg-static is not available.", {
      stage: "frames",
      code: "ffmpeg_missing"
    });
  }

  const timestamps = buildFrameTimestamps(durationSeconds);
  const frames = [];
  const warnings = [];

  for (const [index, second] of timestamps.entries()) {
    const framePath = path.join(outputDirectory, `frame-${index + 1}.jpg`);
    try {
      await runBinary(
        ffmpegPath,
        [
          "-y",
          "-ss",
          String(second),
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-vf",
          "scale='min(1280,iw)':-2",
          framePath
        ],
        "frames"
      );
      frames.push(framePath);
    } catch (error) {
      const failure = normalizeImportError(error, "frames");
      warnings.push(`Frame ${index + 1} at ${second}s could not be extracted: ${failure.message}`);
    }
  }

  return {
    frames,
    warnings
  };
}

async function moderateSingleFrame(framePath, openAiApiKey) {
  const buffer = await fs.readFile(framePath);
  const response = await fetchWithTimeout(
    OPENAI_MODERATIONS_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${buffer.toString("base64")}`
            }
          }
        ]
      })
    },
    {
      stage: "moderation",
      code: "moderation_request_failed",
      timeoutMs: MODERATION_TIMEOUT_MS
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new ImportPipelineError(
      `Moderation request failed (${response.status}): ${shorten(errorText, 400)}`,
      {
        stage: "moderation",
        code: "moderation_request_failed"
      }
    );
  }

  const payload = await response.json();
  return payload?.results?.[0] || null;
}

async function moderateFrames(framePaths) {
  const { openAiApiKey } = getPlatformConfig();
  if (!openAiApiKey) {
    return {
      status: "approved",
      notes: "OpenAI moderation skipped because OPENAI_API_KEY is not configured.",
      categories: "",
      warnings: []
    };
  }

  if (!framePaths.length) {
    return {
      status: "review",
      notes: "No review frames were extracted for moderation.",
      categories: "",
      warnings: []
    };
  }

  const categories = new Set();
  const warnings = [];
  let sawSexualFlag = false;
  let sawNonSexualFlag = false;
  let sawOperationalFailure = false;

  for (const [index, framePath] of framePaths.entries()) {
    try {
      const result = await moderateSingleFrame(framePath, openAiApiKey);
      if (!result) {
        sawOperationalFailure = true;
        warnings.push(`Moderation returned no result for frame ${index + 1}.`);
        continue;
      }

      const flaggedCategories = formatModerationCategories(result.categories || {});
      if (flaggedCategories) {
        for (const category of flaggedCategories.split(",").map((value) => value.trim()).filter(Boolean)) {
          categories.add(category);
        }
      }

      if (result.categories?.["sexual/minors"] || result.categories?.sexual) {
        sawSexualFlag = true;
      } else if (result.flagged) {
        sawNonSexualFlag = true;
      }
    } catch (error) {
      sawOperationalFailure = true;
      const failure = normalizeImportError(error, "moderation");
      warnings.push(`Moderation failed for frame ${index + 1}: ${failure.message}`);
    }
  }

  const categoryText = Array.from(categories).join(", ").slice(0, MAX_CATEGORY_LENGTH);

  if (sawSexualFlag) {
    return {
      status: "rejected",
      notes: "Rejected by frame moderation before import.",
      categories: categoryText || "sexual",
      warnings
    };
  }

  if (sawOperationalFailure) {
    return {
      status: "review",
      notes: "Needs manual review because moderation did not complete for every sampled frame.",
      categories: categoryText,
      warnings
    };
  }

  if (sawNonSexualFlag) {
    return {
      status: "review",
      notes: "Needs manual review because moderation raised a non-sexual safety flag.",
      categories: categoryText,
      warnings
    };
  }

  return {
    status: "approved",
    notes: "Auto-approved by frame moderation.",
    categories: "",
    warnings
  };
}

async function importSingleCandidate(candidate, options) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "drum-blonde-import-"));
  const extension = path.extname(candidate.filename) || getExtensionFromMimeType(candidate.mimeType);
  const localVideoPath = path.join(tempDirectory, `${candidate.externalId}${extension}`);
  const requestedStatus = String(options.workflowStatus || "approved").trim().toLowerCase() || "approved";
  const warnings = [];

  try {
    await downloadCandidateVideo(candidate, localVideoPath);
    const durationData = await getVideoDurationData(localVideoPath);

    if (durationData.exactSeconds > MAX_DURATION_SECONDS) {
      return {
        outcome: "skipped_duration",
        storedStatus: "rejected",
        durationSeconds: durationData.roundedSeconds,
        notes: `Rejected by import rule: ${formatDurationLabel(durationData.exactSeconds)} exceeds the ${formatDurationLabel(MAX_DURATION_SECONDS)} maximum.`,
        warnings,
        recorded: false
      };
    }

    let moderation = {
      status: "approved",
      notes: "",
      warnings: []
    };

    if (requestedStatus === "approved") {
      const frameExtraction = await extractReviewFrames(localVideoPath, durationData.roundedSeconds, tempDirectory);
      warnings.push(...frameExtraction.warnings);
      moderation = await moderateFrames(frameExtraction.frames);
      warnings.push(...moderation.warnings);
    }

    const finalWorkflowStatus = requestedStatus === "approved" ? moderation.status : requestedStatus;
    const buffer = await fs.readFile(localVideoPath);
    const asset = await ingestUploadedMedia({
      buffer,
      mimeType: candidate.mimeType,
      originalFilename: candidate.filename,
      source: "google_photos",
      title: candidate.title,
      description: joinSummaryText([
        candidate.description,
        candidate.productUrl ? `Google Photos source: ${candidate.productUrl}.` : "",
        options.query ? `Matched query: ${options.query}.` : "",
        moderation.notes
      ]),
      tags: options.tags,
      featuredHome: options.featuredHome,
      homeSlot: options.homeSlot,
      manualRank: options.manualRank,
      workflowStatus: finalWorkflowStatus,
      active: finalWorkflowStatus === "approved"
    });

    return {
      outcome: finalWorkflowStatus,
      storedStatus: finalWorkflowStatus,
      durationSeconds: durationData.roundedSeconds,
      notes: moderation.notes || `Imported into workflow status ${finalWorkflowStatus}.`,
      warnings,
      recorded: true,
      assetId: asset.id
    };
  } catch (error) {
    const failure = normalizeImportError(error);
    return {
      outcome: "failed",
      storedStatus: null,
      durationSeconds: null,
      stage: failure.stage,
      error: failure.message,
      notes: joinSummaryText([`Import failed during ${failure.stage}.`, failure.message]),
      warnings,
      recorded: false
    };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function importGooglePhotosVideos({
  albumId = "",
  filenameQuery = DEFAULT_QUERY,
  maxItems = DEFAULT_MAX_ITEMS,
  tags = "brooke, google photos",
  featuredHome = false,
  manualRank = 0,
  homeSlot = null,
  workflowStatus = "approved"
}) {
  if (!hasDatabase() || !hasBlobStore()) {
    throw new Error(`Missing configuration: ${buildStorageRequirements().join(", ") || "database"}`);
  }

  const missingGoogleConfig = buildGooglePhotosRequirements().filter((value) => !buildStorageRequirements().includes(value));
  if (missingGoogleConfig.length) {
    throw new Error(`Missing configuration: ${missingGoogleConfig.join(", ")}`);
  }

  const search = await searchGooglePhotosVideoCandidates({
    albumId: String(albumId || "").trim(),
    filenameQuery: String(filenameQuery || DEFAULT_QUERY).trim(),
    maxItems
  });

  const summary = {
    scanned: search.candidates.length,
    imported: 0,
    queuedReview: 0,
    rejected: 0,
    skippedDuration: 0,
    failed: 0,
    searchDiagnostics: {
      pagesFetched: search.diagnostics.pagesFetched,
      apiItemsSeen: search.diagnostics.apiItemsSeen,
      skippedNonVideo: search.diagnostics.skippedNonVideo,
      skippedProcessing: search.diagnostics.skippedProcessing,
      skippedQuery: search.diagnostics.skippedQuery
    },
    failureStages: {},
    details: []
  };

  for (const candidate of search.candidates) {
    const result = await importSingleCandidate(candidate, {
      query: filenameQuery,
      tags,
      featuredHome,
      manualRank,
      homeSlot,
      workflowStatus
    });

    if (result.outcome === "approved") {
      summary.imported += 1;
    } else if (result.outcome === "review") {
      summary.queuedReview += 1;
    } else if (result.outcome === "rejected") {
      summary.rejected += 1;
    } else if (result.outcome === "skipped_duration") {
      summary.skippedDuration += 1;
    } else if (result.outcome === "failed") {
      summary.failed += 1;
      if (result.stage) {
        summary.failureStages[result.stage] = (summary.failureStages[result.stage] || 0) + 1;
      }
    }

    summary.details.push({
      externalId: candidate.externalId,
      title: candidate.title,
      filename: candidate.filename,
      outcome: result.outcome,
      storedStatus: result.storedStatus || null,
      duration: result.durationSeconds ? formatDurationLabel(result.durationSeconds) : null,
      stage: result.stage || null,
      notes: result.notes || null,
      error: result.error || null,
      warnings: result.warnings || [],
      recorded: result.recorded === true,
      assetId: result.assetId || null
    });
  }

  return summary;
}

export function buildGooglePhotosRequirements() {
  const config = getPlatformConfig();
  const missing = [...buildStorageRequirements()];

  if (
    !config.googlePhotosAccessToken &&
    !(config.googlePhotosRefreshToken && config.googleOauthClientId && config.googleOauthClientSecret)
  ) {
    if (!config.googlePhotosAccessToken && !config.googlePhotosRefreshToken) {
      missing.push("GOOGLE_PHOTOS_ACCESS_TOKEN or GOOGLE_PHOTOS_REFRESH_TOKEN");
    }

    if (!config.googleOauthClientId) {
      missing.push("GOOGLE_OAUTH_CLIENT_ID");
    }

    if (!config.googleOauthClientSecret) {
      missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
    }
  }

  return Array.from(new Set(missing));
}

