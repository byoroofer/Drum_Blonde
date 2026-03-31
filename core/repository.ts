import crypto from "node:crypto";
import { buildDemoDashboardSnapshot } from "@/core/demo-data";
import { env, hasSupabaseEnv, isDemoMode } from "@/core/env";
import { getPlatformPolicyList } from "@/core/platforms";
import { executePublish, resolveExecutionMode } from "@/core/publishing";
import { createSupabaseAdminClient } from "@/core/supabase";
import type {
  AuditLogSummary,
  CaptionVariant,
  DashboardSnapshot,
  DashboardUser,
  IngestInput,
  MediaAssetSummary,
  Platform,
  PublishAttemptSummary,
  PublishJobSummary,
  PublishingTargetSummary,
  RepositoryActionResult
} from "@/core/types";
import { inspectUploadedVideo } from "@/core/video";
import { downloadPickedMediaItem, listGooglePhotosPickedItems } from "@/core/google-photos-picker";
import { buildCaptionBlueprint, generateWorkflowBundle } from "@/core/openai-workflows";

const MANUAL_INSTRUCTIONS: Record<Platform, string> = {
  tiktok: "Post through TikTok's approved creator workflow with the prepared caption package.",
  instagram: "Post as a Reel after Meta account linking is completed, or use the prepared manual handoff.",
  youtube_shorts: "Upload through YouTube Studio with the prepared Short title, description, and thumbnail notes.",
  twitch: "Treat Twitch as a source lane only in this MVP.",
  reddit: "Choose the subreddit manually and apply the prepared post-title options and media notes.",
  x: "Use the prepared short caption and media cut in X after a final owner review.",
  facebook: "Publish to an eligible Facebook Page with the prepared caption package.",
  pinterest: "Create a Pin or Idea Pin manually with the prepared media and text package."
};

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTextArray(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function resolveStorageUrl(storagePath: string | null) {
  if (!storagePath || !hasSupabaseEnv()) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  if (env.storagePublic) {
    return admin.storage.from(env.storageBucket).getPublicUrl(storagePath).data.publicUrl;
  }

  const signed = await admin.storage.from(env.storageBucket).createSignedUrl(storagePath, 60 * 60);
  return signed.data?.signedUrl ?? null;
}

async function fetchRows(table: string, columns = "*") {
  const admin = createSupabaseAdminClient();
  const response = await admin.from(table).select(columns);
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data ?? [];
}

async function getCreator(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const creator = await admin.from("creators").select("id, slug").eq("slug", env.defaultCreatorSlug).single();
  if (creator.error) {
    throw new Error(creator.error.message);
  }
  return creator.data;
}

async function createAuditLog(actor: DashboardUser | null, eventType: string, entityType: string, entityId: string | null, severity: string, message: string, metadata: Record<string, unknown> = {}) {
  if (!hasSupabaseEnv()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_user_id: actor?.mode === "supabase" ? actor.id : null,
    actor_label: actor?.displayName ?? "system",
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    severity,
    message,
    metadata
  });
}

async function ensureTags(admin: ReturnType<typeof createSupabaseAdminClient>, tags: string[]) {
  const cleanTags = parseTextArray(tags);
  if (!cleanTags.length) {
    return [] as Array<{ id: string; slug: string; label: string }>;
  }

  for (const tag of cleanTags) {
    await admin.from("tags").upsert({ slug: slugify(tag), label: tag, category: "custom" }, { onConflict: "slug" });
  }

  const fetched = await admin.from("tags").select("id, slug, label").in("slug", cleanTags.map(slugify));
  if (fetched.error) {
    throw new Error(fetched.error.message);
  }
  return fetched.data ?? [];
}

async function linkTags(admin: ReturnType<typeof createSupabaseAdminClient>, assetId: string, tagIds: string[]) {
  if (!tagIds.length) {
    return;
  }

  const payload = tagIds.map((tagId) => ({ media_asset_id: assetId, tag_id: tagId }));
  await admin.from("media_tag_links").upsert(payload, { onConflict: "media_asset_id,tag_id" });
}

async function insertPublishJobs(admin: ReturnType<typeof createSupabaseAdminClient>, creatorId: string, assetId: string, targets: Array<{ id: string; scheduled_for: string | null }>) {
  if (!targets.length) {
    return;
  }

  const payload = targets.map((target) => ({
    creator_id: creatorId,
    media_asset_id: assetId,
    publishing_target_id: target.id,
    job_type: "publish",
    status: target.scheduled_for ? "scheduled" : "queued",
    run_at: target.scheduled_for
  }));

  await admin.from("publish_jobs").insert(payload);
}

function mapCaptionRows(rows: any[], hashtagRows: any[]): CaptionVariant[] {
  const hashtagsByKey = new Map<string, string[]>();
  for (const row of hashtagRows) {
    hashtagsByKey.set(`${row.media_asset_id}:${row.platform}`, row.hashtags ?? []);
  }

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    variantName: row.variant_name,
    titleText: row.title_text ?? "",
    captionText: row.caption_text,
    callToAction: row.call_to_action ?? "",
    hashtags: hashtagsByKey.get(`${row.media_asset_id}:${row.platform}`) ?? [],
    selected: row.is_selected === true
  }));
}

async function mapAssets(snapshot: {
  mediaAssets: any[];
  captions: any[];
  hashtagSets: any[];
  targets: any[];
  tagLinks: any[];
  tags: any[];
}): Promise<MediaAssetSummary[]> {
  const tagsById = new Map(snapshot.tags.map((tag) => [tag.id, tag.label]));
  const tagIdsByAsset = new Map<string, string[]>();
  for (const link of snapshot.tagLinks) {
    const current = tagIdsByAsset.get(link.media_asset_id) ?? [];
    current.push(link.tag_id);
    tagIdsByAsset.set(link.media_asset_id, current);
  }

  const captionsByAsset = new Map<string, CaptionVariant[]>();
  const mappedCaptions = mapCaptionRows(snapshot.captions, snapshot.hashtagSets);
  for (const caption of mappedCaptions) {
    const current = captionsByAsset.get((snapshot.captions.find((row) => row.id === caption.id) as any).media_asset_id) ?? [];
    current.push(caption);
    captionsByAsset.set((snapshot.captions.find((row) => row.id === caption.id) as any).media_asset_id, current);
  }

  const targetsByAsset = new Map<string, PublishingTargetSummary[]>();
  for (const row of snapshot.targets) {
    const current = targetsByAsset.get(row.media_asset_id) ?? [];
    current.push({
      id: row.id,
      platform: row.platform,
      executionMode: row.execution_mode,
      connectorStatus: row.connector_status,
      status: row.status,
      scheduledFor: row.scheduled_for,
      externalUrl: row.external_url,
      lastError: row.last_error,
      captionId: row.selected_caption_id,
      hashtagSetId: row.selected_hashtag_set_id,
      allowRepost: row.allow_repost === true,
      manualInstructions: row.manual_instructions
    });
    targetsByAsset.set(row.media_asset_id, current);
  }

  return Promise.all(
    snapshot.mediaAssets.map(async (row) => ({
      id: row.id,
      title: row.title,
      description: row.source_caption ?? "",
      originalFilename: row.original_filename,
      sourceType: row.source_type,
      sourcePlatform: row.source_platform ?? (row.source_type === "upload" ? "upload" : null),
      sourceUrl: row.source_url,
      sourcePostedAt: row.source_posted_at,
      mimeType: row.mime_type,
      durationSeconds: row.duration_seconds,
      width: row.width,
      height: row.height,
      status: row.lifecycle_status,
      approvalStatus: row.approval_status,
      voicePreset: row.voice_preset,
      campaign: row.campaign,
      creatorNotes: row.creator_notes,
      checksum: row.checksum_sha256,
      duplicateRisk: (row.duplicate_override === true ? "warning" : "clear") as "warning" | "clear",
      publicUrl: row.public_url ?? (await resolveStorageUrl(row.storage_path)),
      thumbnailUrl: row.thumbnail_url ?? (await resolveStorageUrl(row.storage_path)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags: (tagIdsByAsset.get(row.id) ?? []).map((id) => tagsById.get(id) ?? id),
      captions: captionsByAsset.get(row.id) ?? [],
      targets: targetsByAsset.get(row.id) ?? []
    }))
  );
}

export async function getDashboardSnapshot(user: DashboardUser): Promise<DashboardSnapshot> {
  if (isDemoMode()) {
    return buildDemoDashboardSnapshot();
  }

  try {
    const [mediaAssets, captions, hashtagSets, targets, jobs, attempts, accounts, auditLogs, tags, tagLinks] = await Promise.all([
      fetchRows("media_assets"),
      fetchRows("captions"),
      fetchRows("hashtag_sets"),
      fetchRows("publishing_targets"),
      fetchRows("publish_jobs"),
      fetchRows("publish_attempts"),
      fetchRows("connected_accounts"),
      fetchRows("audit_logs"),
      fetchRows("tags"),
      fetchRows("media_tag_links")
    ]);

    const assets = (await mapAssets({ mediaAssets, captions, hashtagSets, targets, tagLinks, tags })).sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    const targetsAny = targets as any[];
    const jobsAny = jobs as any[];
    const attemptsAny = attempts as any[];
    const accountsAny = accounts as any[];
    const auditLogsAny = auditLogs as any[];
    const jobAssetLookup = new Map(assets.map((asset) => [asset.id, asset.title]));
    const jobsMapped: PublishJobSummary[] = jobsAny.map((row: any) => ({
      id: row.id,
      platform: (targetsAny.find((target: any) => target.id === row.publishing_target_id)?.platform ?? "instagram") as Platform,
      status: row.status,
      runAt: row.run_at,
      completedAt: row.completed_at,
      attemptCount: Number(row.attempt_count ?? 0),
      workerNotes: row.worker_notes,
      assetTitle: jobAssetLookup.get(row.media_asset_id) ?? "Unknown asset"
    }));

    const attemptsMapped: PublishAttemptSummary[] = attemptsAny.map((row: any) => ({
      id: row.id,
      platform: (targetsAny.find((target: any) => target.id === row.publishing_target_id)?.platform ?? "instagram") as Platform,
      status: row.status,
      responseExcerpt: row.response_excerpt,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      assetTitle: jobAssetLookup.get(jobsAny.find((job: any) => job.id === row.publish_job_id)?.media_asset_id) ?? "Unknown asset"
    }));

    const accountsMapped = accountsAny.map((row: any) => ({
      id: row.id,
      platform: row.platform,
      label: row.account_label,
      handle: row.account_handle ?? "",
      status: row.status,
      publishMode: row.publish_mode,
      scopes: row.scopes ?? [],
      expiresAt: row.token_expires_at
    }));

    const logsMapped: AuditLogSummary[] = auditLogsAny
      .sort((left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 40)
      .map((row: any) => ({
        id: row.id,
        severity: row.severity,
        eventType: row.event_type,
        entityType: row.entity_type,
        message: row.message,
        createdAt: row.created_at
      }));

    return {
      mode: "live",
      user,
      policies: getPlatformPolicyList(),
      accounts: accountsMapped,
      assets,
      jobs: jobsMapped,
      attempts: attemptsMapped,
      auditLogs: logsMapped
    };
  } catch {
    return buildDemoDashboardSnapshot();
  }
}

export async function ingestMedia(input: IngestInput): Promise<RepositoryActionResult> {
  if (isDemoMode()) {
    return { ok: true, message: "Demo mode is read-only. Connect Supabase to persist uploads.", notice: "demo" };
  }

  const admin = createSupabaseAdminClient();
  const creator = await getCreator(admin);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const duplicateMatch = await admin.from("media_assets").select("id, title").eq("checksum_sha256", checksum).limit(1).maybeSingle();
  const now = nowIso();
  const storagePath = `originals/${creator.slug}/${now.slice(0, 10)}/${crypto.randomUUID()}-${input.file.name.replace(/[^\w.-]+/g, "-")}`;

  const upload = await admin.storage.from(env.storageBucket).upload(storagePath, buffer, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false
  });
  if (upload.error) {
    throw new Error(upload.error.message);
  }

  let thumbnailUrl: string | null = null;
  let durationSeconds: number | null = null;
  let width: number | null = null;
  let height: number | null = null;

  if ((input.file.type || "").startsWith("video/")) {
    const inspected = await inspectUploadedVideo(buffer, input.file.name);
    durationSeconds = inspected.durationSeconds;
    width = inspected.width;
    height = inspected.height;

    if (inspected.thumbnailBuffer) {
      const thumbPath = `thumbnails/${creator.slug}/${crypto.randomUUID()}.jpg`;
      const thumbUpload = await admin.storage.from(env.storageBucket).upload(thumbPath, inspected.thumbnailBuffer, {
        contentType: "image/jpeg",
        upsert: false
      });
      if (!thumbUpload.error) {
        thumbnailUrl = env.storagePublic
          ? admin.storage.from(env.storageBucket).getPublicUrl(thumbPath).data.publicUrl
          : (await admin.storage.from(env.storageBucket).createSignedUrl(thumbPath, 60 * 60)).data?.signedUrl ?? null;
      }
    }
  }

  const publicUrl = env.storagePublic
    ? admin.storage.from(env.storageBucket).getPublicUrl(storagePath).data.publicUrl
    : (await admin.storage.from(env.storageBucket).createSignedUrl(storagePath, 60 * 60)).data?.signedUrl ?? null;

  const approvalStatus = input.approvalPolicy === "human_required" ? "pending" : "approved";
  const lifecycleStatus = input.approvalPolicy === "human_required" ? "draft" : "approved";

  const insertedAsset = await admin
    .from("media_assets")
    .insert({
      creator_id: creator.id,
      source_type: input.sourcePlatform === "upload" ? "upload" : input.sourcePlatform,
      source_platform: input.sourcePlatform === "upload" || input.sourcePlatform === "library" ? null : input.sourcePlatform,
      source_url: input.sourceUrl,
      original_filename: input.file.name,
      checksum_sha256: checksum,
      storage_bucket: env.storageBucket,
      storage_path: storagePath,
      public_url: publicUrl,
      thumbnail_url: thumbnailUrl,
      mime_type: input.file.type || "application/octet-stream",
      duration_seconds: durationSeconds,
      width,
      height,
      title: input.title || input.file.name,
      source_caption: input.description,
      creator_notes: input.creatorNotes,
      campaign: input.campaign,
      voice_preset: input.voicePreset,
      lifecycle_status: lifecycleStatus,
      approval_status: approvalStatus,
      approval_policy: input.approvalPolicy,
      auto_post_approved: input.approvalPolicy === "auto_post_approved_only",
      scheduled_for: input.scheduledFor,
      duplicate_override: false,
      created_by: input.actor.mode === "supabase" ? input.actor.id : null,
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();

  if (insertedAsset.error || !insertedAsset.data) {
    throw new Error(insertedAsset.error?.message || "Unable to insert media asset.");
  }

  const tagRows = await ensureTags(admin, input.tags);
  await linkTags(admin, insertedAsset.data.id, tagRows.map((row) => row.id));

  let aiWorkflow: Awaited<ReturnType<typeof generateWorkflowBundle>> | null = null;
  try {
    aiWorkflow = await generateWorkflowBundle({
      title: input.title || input.file.name,
      description: input.description,
      tags: input.tags,
      voicePreset: input.voicePreset,
      platforms: input.destinations
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }

  const captionBlueprint = aiWorkflow?.captions.length
    ? aiWorkflow.captions
    : buildCaptionBlueprint({
        title: input.title || input.file.name,
        description: input.description,
        tags: input.tags,
        voicePreset: input.voicePreset,
        platforms: input.destinations
      });

  const captionInsert = await admin
    .from("captions")
    .insert(
      captionBlueprint.map((variant, index) => ({
        media_asset_id: insertedAsset.data.id,
        platform: variant.platform,
        voice_preset: input.voicePreset,
        variant_name: variant.variantName,
        title_text: variant.titleText,
        caption_text: variant.captionText,
        call_to_action: variant.callToAction,
        is_selected: index % 2 === 0
      }))
    )
    .select("*");
  if (captionInsert.error) {
    throw new Error(captionInsert.error.message);
  }

  const hashtagInsert = await admin
    .from("hashtag_sets")
    .insert(
      captionBlueprint.map((variant, index) => ({
        media_asset_id: insertedAsset.data.id,
        platform: variant.platform,
        set_name: `${variant.variantName} Hashtags`,
        hashtags: variant.hashtags,
        is_selected: index % 2 === 0
      }))
    )
    .select("*");
  if (hashtagInsert.error) {
    throw new Error(hashtagInsert.error.message);
  }

  const selectedCaptionByPlatform = new Map<string, any>();
  for (const row of captionInsert.data ?? []) {
    if (row.is_selected) {
      selectedCaptionByPlatform.set(row.platform, row);
    }
  }
  const selectedHashtagsByPlatform = new Map<string, any>();
  for (const row of hashtagInsert.data ?? []) {
    if (row.is_selected) {
      selectedHashtagsByPlatform.set(row.platform, row);
    }
  }

  const targetInsert = await admin
    .from("publishing_targets")
    .insert(
      input.destinations.map((platform) => ({
        media_asset_id: insertedAsset.data.id,
        platform,
        execution_mode: resolveExecutionMode(platform),
        connector_status: resolveExecutionMode(platform) === "source_only" ? "Source only" : "Prepared",
        selected_caption_id: selectedCaptionByPlatform.get(platform)?.id ?? null,
        selected_hashtag_set_id: selectedHashtagsByPlatform.get(platform)?.id ?? null,
        scheduled_for: input.scheduledFor,
        allow_repost: false,
        manual_instructions: MANUAL_INSTRUCTIONS[platform],
        status: input.approvalPolicy === "human_required" ? "pending_approval" : "queued",
        created_at: now,
        updated_at: now
      }))
    )
    .select("id, scheduled_for");

  if (targetInsert.error) {
    throw new Error(targetInsert.error.message);
  }

  await admin.from("approval_records").insert({
    media_asset_id: insertedAsset.data.id,
    requested_by: input.actor.mode === "supabase" ? input.actor.id : null,
    reviewed_by: input.approvalPolicy === "auto_post_approved_only" && input.actor.mode === "supabase" ? input.actor.id : null,
    decision: approvalStatus,
    decision_notes: input.approvalPolicy === "auto_post_approved_only" ? "Auto-approved on ingest by approved-only mode." : null,
    created_at: now,
    reviewed_at: input.approvalPolicy === "auto_post_approved_only" ? now : null
  });

  if (duplicateMatch.data?.id) {
    await admin.from("duplicate_checks").insert({
      media_asset_id: insertedAsset.data.id,
      checksum_sha256: checksum,
      matched_media_asset_id: duplicateMatch.data.id,
      result: "checksum_match",
      blocking: true,
      details: { matchedTitle: duplicateMatch.data.title }
    });
  }

  if (input.approvalPolicy === "auto_post_approved_only") {
    await insertPublishJobs(admin, creator.id, insertedAsset.data.id, targetInsert.data ?? []);
  }

  await createAuditLog(input.actor, "asset_ingested", "media_assets", insertedAsset.data.id, duplicateMatch.data?.id ? "warning" : "info", `Ingested ${insertedAsset.data.title}.`, {
    destinations: input.destinations,
    duplicateMatchedAssetId: duplicateMatch.data?.id ?? null,
    openAiUsed: Boolean(aiWorkflow?.captions.length)
  });

  if (aiWorkflow?.captions.length) {
    await createAuditLog(input.actor, "workflow_ai_generated", "media_assets", insertedAsset.data.id, "info", `OpenAI prepared workflow variants for ${insertedAsset.data.title}.`, {
      model: aiWorkflow.model,
      summary: aiWorkflow.summary,
      reviewNotes: aiWorkflow.reviewNotes,
      platforms: input.destinations
    });
  }

  return { ok: true, message: "Media ingested successfully.", notice: duplicateMatch.data?.id ? "duplicate-warning" : "uploaded" };
}

export async function reviewAsset(assetId: string, decision: "approved" | "rejected" | "revision_requested", actor: DashboardUser): Promise<RepositoryActionResult> {
  if (isDemoMode()) {
    return { ok: true, message: "Demo mode review recorded locally only.", notice: "demo" };
  }

  const admin = createSupabaseAdminClient();
  const now = nowIso();
  const assetLookup = await admin.from("media_assets").select("id, creator_id, title, auto_post_approved").eq("id", assetId).single();
  if (assetLookup.error || !assetLookup.data) {
    throw new Error(assetLookup.error?.message || "Asset not found.");
  }

  const lifecycle = decision === "approved" ? "approved" : decision === "rejected" ? "failed" : "draft";
  await admin.from("media_assets").update({ approval_status: decision, lifecycle_status: lifecycle, updated_at: now }).eq("id", assetId);
  await admin.from("approval_records").insert({
    media_asset_id: assetId,
    requested_by: null,
    reviewed_by: actor.mode === "supabase" ? actor.id : null,
    decision,
    decision_notes: null,
    created_at: now,
    reviewed_at: now
  });

  if (decision === "approved") {
    const targets = await admin.from("publishing_targets").select("id, scheduled_for").eq("media_asset_id", assetId);
    if (targets.error) {
      throw new Error(targets.error.message);
    }
    await admin.from("publishing_targets").update({ status: "queued", updated_at: now }).eq("media_asset_id", assetId);
    await insertPublishJobs(admin, assetLookup.data.creator_id, assetId, targets.data ?? []);
  }

  await createAuditLog(actor, "asset_reviewed", "media_assets", assetId, decision === "approved" ? "info" : "warning", `${assetLookup.data.title} marked ${decision}.`);
  return { ok: true, message: `Asset ${decision}.`, notice: decision };
}

export async function queueAssetTargets(assetId: string, actor: DashboardUser): Promise<RepositoryActionResult> {
  if (isDemoMode()) {
    return { ok: true, message: "Demo mode queue updated locally only.", notice: "demo" };
  }

  const admin = createSupabaseAdminClient();
  const assetLookup = await admin.from("media_assets").select("id, creator_id, title").eq("id", assetId).single();
  if (assetLookup.error || !assetLookup.data) {
    throw new Error(assetLookup.error?.message || "Asset not found.");
  }

  const targets = await admin.from("publishing_targets").select("id, scheduled_for").eq("media_asset_id", assetId);
  if (targets.error) {
    throw new Error(targets.error.message);
  }

  await insertPublishJobs(admin, assetLookup.data.creator_id, assetId, targets.data ?? []);
  await admin.from("publishing_targets").update({ status: "queued", updated_at: nowIso() }).eq("media_asset_id", assetId);
  await createAuditLog(actor, "asset_queued", "media_assets", assetId, "info", `${assetLookup.data.title} queued for publishing.`);
  return { ok: true, message: "Targets queued.", notice: "queued" };
}

export async function runQueuedJobs(limit = 10) {
  if (isDemoMode()) {
    return { processed: 0, mode: "demo", results: [] as Array<Record<string, unknown>> };
  }

  const admin = createSupabaseAdminClient();
  const snapshot = await getDashboardSnapshot({ id: "system", email: "system@local", displayName: "Worker", role: "owner", mode: "supabase" });
  const dueJobs = snapshot.jobs
    .filter((job) => job.status === "queued" || (job.status === "scheduled" && (!job.runAt || new Date(job.runAt).getTime() <= Date.now())))
    .slice(0, limit);

  const results: Array<Record<string, unknown>> = [];

  for (const job of dueJobs) {
    const targetRow = (await admin.from("publishing_targets").select("*").eq("id", (await admin.from("publish_jobs").select("publishing_target_id").eq("id", job.id).single()).data?.publishing_target_id).single()).data;
    const asset = snapshot.assets.find((entry) => entry.title === job.assetTitle && entry.targets.some((target) => target.platform === job.platform));
    if (!targetRow || !asset) {
      continue;
    }

    const target = asset.targets.find((entry) => entry.id === targetRow.id) as PublishingTargetSummary;
    const account = snapshot.accounts.find((entry) => entry.platform === job.platform);
    await admin.from("publish_jobs").update({ status: "processing", claimed_at: nowIso(), updated_at: nowIso() }).eq("id", job.id);
    const outcome = await executePublish(asset, target, account);

    if (outcome.status === "manual_handoff") {
      await admin.from("publish_attempts").insert({
        publish_job_id: job.id,
        publishing_target_id: target.id,
        status: "manual_handoff",
        response_excerpt: outcome.message,
        manual_handoff_payload: outcome.manualPayload ?? {},
        started_at: nowIso(),
        finished_at: nowIso(),
        created_at: nowIso()
      });
      await admin.from("publish_jobs").update({ status: "manual_action_required", completed_at: nowIso(), attempt_count: job.attemptCount + 1, worker_notes: outcome.message, updated_at: nowIso() }).eq("id", job.id);
      await admin.from("publishing_targets").update({ status: "manual_review", last_error: outcome.message, updated_at: nowIso() }).eq("id", target.id);
      await createAuditLog(null, "publish_job_manual_handoff", "publish_jobs", job.id, "warning", outcome.message, outcome.manualPayload ?? {});
    } else if (outcome.status === "failed") {
      await admin.from("publish_attempts").insert({
        publish_job_id: job.id,
        publishing_target_id: target.id,
        status: "failed",
        response_excerpt: outcome.message,
        manual_handoff_payload: {},
        started_at: nowIso(),
        finished_at: nowIso(),
        created_at: nowIso()
      });
      await admin.from("publish_jobs").update({ status: "failed", completed_at: nowIso(), attempt_count: job.attemptCount + 1, worker_notes: outcome.message, updated_at: nowIso() }).eq("id", job.id);
      await admin.from("publishing_targets").update({ status: "failed", last_error: outcome.message, updated_at: nowIso() }).eq("id", target.id);
      await createAuditLog(null, "publish_job_failed", "publish_jobs", job.id, "error", outcome.message);
    }

    results.push({ jobId: job.id, platform: job.platform, status: outcome.status, message: outcome.message });
  }

  return { processed: results.length, mode: "live", results };
}






export async function importGooglePhotosSelection({
  actor,
  sessionId,
  selectedIds,
  titlePrefix,
  description,
  creatorNotes,
  campaign,
  voicePreset,
  tags,
  destinations,
  scheduledFor,
  approvalPolicy
}: {
  actor: DashboardUser;
  sessionId: string;
  selectedIds: string[];
  titlePrefix: string;
  description: string;
  creatorNotes: string | null;
  campaign: string | null;
  voicePreset: IngestInput["voicePreset"];
  tags: string[];
  destinations: Platform[];
  scheduledFor: string | null;
  approvalPolicy: IngestInput["approvalPolicy"];
}) {
  const pickedItems = await listGooglePhotosPickedItems(sessionId);
  const desiredIds = new Set(selectedIds.filter(Boolean));
  const itemsToImport = desiredIds.size
    ? pickedItems.filter((item) => desiredIds.has(item.id))
    : pickedItems;

  const importedAssetIds: string[] = [];
  const skippedIds: string[] = [];

  for (const item of itemsToImport) {
    try {
      const buffer = await downloadPickedMediaItem(item);
      const file = new File([buffer], item.filename, {
        type: item.mimeType || "application/octet-stream",
        lastModified: item.createTime ? new Date(item.createTime).getTime() : Date.now()
      });

      const baseName = item.filename.replace(/\.[^.]+$/, "");
      const title = titlePrefix ? `${titlePrefix} ${baseName}`.trim() : baseName;
      const result = await ingestMedia({
        actor,
        file,
        title,
        description,
        sourcePlatform: "library",
        sourceUrl: `google-photos-picker:${item.id}`,
        creatorNotes,
        campaign,
        voicePreset,
        tags,
        destinations,
        scheduledFor,
        approvalPolicy
      });

      if (result.ok) {
        importedAssetIds.push(item.id);
      } else {
        skippedIds.push(item.id);
      }
    } catch {
      skippedIds.push(item.id);
    }
  }

  return {
    importedCount: importedAssetIds.length,
    importedAssetIds,
    skippedCount: skippedIds.length,
    skippedIds
  };
}