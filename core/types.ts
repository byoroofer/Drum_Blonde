export type Platform =
  | "tiktok"
  | "instagram"
  | "youtube_shorts"
  | "twitch"
  | "reddit"
  | "x"
  | "facebook"
  | "pinterest";

export type VoicePreset =
  | "playful"
  | "drummer_girl"
  | "confident"
  | "flirty_safe"
  | "livestream_growth";

export type AssetStatus = "draft" | "approved" | "queued" | "posted" | "failed" | "archived";
export type ApprovalDecision = "pending" | "approved" | "rejected" | "revision_requested";
export type ExecutionMode = "direct" | "manual_handoff" | "source_only";
export type PublishJobStatus =
  | "queued"
  | "scheduled"
  | "processing"
  | "published"
  | "manual_action_required"
  | "failed"
  | "cancelled";

export interface DashboardUser {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "admin" | "editor" | "viewer";
  mode: "demo" | "supabase";
}

export interface PlatformPolicy {
  platform: Platform;
  label: string;
  direction: "source" | "destination" | "both";
  officialAutomation: string;
  mvpExecution: string;
  notes: string;
}

export interface ConnectedAccountSummary {
  id: string;
  platform: Platform;
  label: string;
  handle: string;
  status: string;
  publishMode: ExecutionMode;
  scopes: string[];
  expiresAt: string | null;
}

export interface CaptionVariant {
  id: string;
  platform: Platform;
  variantName: string;
  titleText: string;
  captionText: string;
  callToAction: string;
  hashtags: string[];
  selected: boolean;
}

export interface PublishingTargetSummary {
  id: string;
  platform: Platform;
  executionMode: ExecutionMode;
  connectorStatus: string;
  status: string;
  scheduledFor: string | null;
  externalUrl: string | null;
  lastError: string | null;
  captionId: string | null;
  hashtagSetId: string | null;
  allowRepost: boolean;
  manualInstructions: string | null;
}

export interface PublishJobSummary {
  id: string;
  platform: Platform;
  status: PublishJobStatus;
  runAt: string | null;
  completedAt: string | null;
  attemptCount: number;
  workerNotes: string | null;
  assetTitle: string;
}

export interface PublishAttemptSummary {
  id: string;
  platform: Platform;
  status: string;
  responseExcerpt: string | null;
  startedAt: string;
  finishedAt: string | null;
  assetTitle: string;
}

export interface AuditLogSummary {
  id: string;
  severity: "info" | "warning" | "error";
  eventType: string;
  entityType: string;
  message: string;
  createdAt: string;
}

export interface MediaAssetSummary {
  id: string;
  title: string;
  description: string;
  originalFilename: string;
  sourceType: string;
  sourcePlatform: Platform | "upload" | "library" | null;
  sourceUrl: string | null;
  sourcePostedAt: string | null;
  mimeType: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  status: AssetStatus;
  approvalStatus: ApprovalDecision;
  voicePreset: VoicePreset;
  campaign: string | null;
  creatorNotes: string | null;
  checksum: string | null;
  duplicateRisk: "clear" | "warning" | "blocked";
  publicUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  captions: CaptionVariant[];
  targets: PublishingTargetSummary[];
}

export interface DashboardSnapshot {
  mode: "demo" | "live";
  user: DashboardUser;
  policies: PlatformPolicy[];
  accounts: ConnectedAccountSummary[];
  assets: MediaAssetSummary[];
  jobs: PublishJobSummary[];
  attempts: PublishAttemptSummary[];
  auditLogs: AuditLogSummary[];
}

export interface RepositoryActionResult {
  ok: boolean;
  message: string;
  notice?: string;
}

export interface IngestInput {
  actor: DashboardUser;
  file: File;
  title: string;
  description: string;
  sourcePlatform: Platform | "upload" | "library";
  sourceUrl: string | null;
  creatorNotes: string | null;
  campaign: string | null;
  voicePreset: VoicePreset;
  tags: string[];
  destinations: Platform[];
  scheduledFor: string | null;
  approvalPolicy: "human_required" | "auto_post_approved_only";
}


export interface GooglePhotosPickerSessionSummary {
  id: string;
  pickerUri: string;
  mediaItemsSet: boolean;
  expireTime: string | null;
  pollIntervalMs: number;
  timeoutMs: number;
}

export interface GooglePhotosPickedItemSummary {
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

export interface GooglePhotosImportSummary {
  importedCount: number;
  importedAssetIds: string[];
  skippedCount: number;
  skippedIds: string[];
}