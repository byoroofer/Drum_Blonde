import type {
  AuditLogSummary,
  ConnectedAccountSummary,
  DashboardSnapshot,
  DashboardUser,
  MediaAssetSummary,
  PlatformPolicy,
  PublishAttemptSummary,
  PublishJobSummary
} from "@/core/types";
import { getPlatformPolicyList } from "@/core/platforms";

export const DEMO_USER: DashboardUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "brooke-demo@local.test",
  displayName: "Brooke Demo",
  role: "owner",
  mode: "demo"
};

const demoPolicies: PlatformPolicy[] = getPlatformPolicyList();

const demoAccounts: ConnectedAccountSummary[] = [
  {
    id: "acc-instagram",
    platform: "instagram",
    label: "Brooke Main Reels",
    handle: "@brookedrums",
    status: "Needs OAuth",
    publishMode: "manual_handoff",
    scopes: ["instagram_basic", "instagram_content_publish"],
    expiresAt: null
  },
  {
    id: "acc-youtube",
    platform: "youtube_shorts",
    label: "Brooke Shorts",
    handle: "@BrookeDrums",
    status: "Not linked",
    publishMode: "manual_handoff",
    scopes: ["youtube.upload"],
    expiresAt: null
  },
  {
    id: "acc-twitch",
    platform: "twitch",
    label: "Brooke Live",
    handle: "brookedrumslive",
    status: "Source ready",
    publishMode: "source_only",
    scopes: ["clips:edit"],
    expiresAt: null
  }
];

const demoAssets: MediaAssetSummary[] = [
  {
    id: "asset-1",
    title: "Double-Kick Warmup Burst",
    description: "Vertical practice clip cut to hit fast on short-form feeds.",
    originalFilename: "brooke-clip-01.mp4",
    sourceType: "upload",
    sourcePlatform: "upload",
    sourceUrl: null,
    sourcePostedAt: null,
    mimeType: "video/mp4",
    durationSeconds: 23,
    width: 1080,
    height: 1920,
    status: "approved",
    approvalStatus: "approved",
    voicePreset: "drummer_girl",
    campaign: "spring-practice",
    creatorNotes: "Lead with the footwork section.",
    checksum: "demo-sha-1",
    duplicateRisk: "clear",
    publicUrl: "/media/brooke-clip-01.mp4",
    thumbnailUrl: "/media/brooke-01.jpg",
    createdAt: "2026-03-29T18:00:00.000Z",
    updatedAt: "2026-03-30T15:12:00.000Z",
    tags: ["practice clip", "viral candidate", "music influencer"],
    captions: [
      {
        id: "cap-1",
        platform: "tiktok",
        variantName: "Primary",
        titleText: "Double-Kick Warmup Burst | TikTok",
        captionText: "Built around feel, timing, and drum-first energy. Double-kick warmup before the heavier takes.",
        callToAction: "Save it if the groove hit.",
        hashtags: ["drumtok", "drummergirl", "practiceclip"],
        selected: true
      }
    ],
    targets: [
      {
        id: "target-1",
        platform: "tiktok",
        executionMode: "manual_handoff",
        connectorStatus: "Prepared",
        status: "queued",
        scheduledFor: "2026-03-31T16:00:00.000Z",
        externalUrl: null,
        lastError: null,
        captionId: "cap-1",
        hashtagSetId: "hash-1",
        allowRepost: false,
        manualInstructions: "Upload through TikTok's approved creator workflow and paste the prepared caption."
      },
      {
        id: "target-2",
        platform: "instagram",
        executionMode: "manual_handoff",
        connectorStatus: "Prepared",
        status: "queued",
        scheduledFor: "2026-03-31T17:30:00.000Z",
        externalUrl: null,
        lastError: null,
        captionId: "cap-2",
        hashtagSetId: "hash-2",
        allowRepost: false,
        manualInstructions: "Post as a Reel after approval because Meta OAuth is not yet linked."
      }
    ]
  },
  {
    id: "asset-2",
    title: "Livestream Fill Breakdown",
    description: "Cut from Twitch, built for YouTube Shorts and X follow-through.",
    originalFilename: "brooke-clip-02.mp4",
    sourceType: "twitch_clip",
    sourcePlatform: "twitch",
    sourceUrl: "https://twitch.tv/clip/example",
    sourcePostedAt: "2026-03-28T03:05:00.000Z",
    mimeType: "video/mp4",
    durationSeconds: 41,
    width: 1080,
    height: 1920,
    status: "queued",
    approvalStatus: "approved",
    voicePreset: "livestream_growth",
    campaign: "live-funnel",
    creatorNotes: "Push the stream CTA harder on Twitch/X.",
    checksum: "demo-sha-2",
    duplicateRisk: "warning",
    publicUrl: "/media/brooke-clip-02.mp4",
    thumbnailUrl: "/media/brooke-02.jpg",
    createdAt: "2026-03-29T11:00:00.000Z",
    updatedAt: "2026-03-30T14:10:00.000Z",
    tags: ["livestream highlight", "beginner journey", "drum cover"],
    captions: [],
    targets: [
      {
        id: "target-3",
        platform: "youtube_shorts",
        executionMode: "manual_handoff",
        connectorStatus: "Awaiting OAuth",
        status: "queued",
        scheduledFor: "2026-03-30T21:00:00.000Z",
        externalUrl: null,
        lastError: "Direct upload intentionally disabled until Google OAuth is linked.",
        captionId: null,
        hashtagSetId: null,
        allowRepost: false,
        manualInstructions: "Use the prepared Short title and description in Studio."
      },
      {
        id: "target-4",
        platform: "x",
        executionMode: "manual_handoff",
        connectorStatus: "Plan required",
        status: "manual_review",
        scheduledFor: null,
        externalUrl: null,
        lastError: null,
        captionId: null,
        hashtagSetId: null,
        allowRepost: false,
        manualInstructions: "Trim to the hook, keep copy under the current X limit, then publish from the prepared queue."
      }
    ]
  },
  {
    id: "asset-3",
    title: "Stick Drop Recovery",
    description: "Funny moment that still shows control and audience reaction.",
    originalFilename: "brooke-03.jpg",
    sourceType: "upload",
    sourcePlatform: "upload",
    sourceUrl: null,
    sourcePostedAt: null,
    mimeType: "image/jpeg",
    durationSeconds: null,
    width: 1440,
    height: 1800,
    status: "draft",
    approvalStatus: "pending",
    voicePreset: "playful",
    campaign: "personality",
    creatorNotes: "Probably best for Instagram, Facebook, and Pinterest.",
    checksum: "demo-sha-3",
    duplicateRisk: "clear",
    publicUrl: "/media/brooke-03.jpg",
    thumbnailUrl: "/media/brooke-03.jpg",
    createdAt: "2026-03-30T09:00:00.000Z",
    updatedAt: "2026-03-30T09:00:00.000Z",
    tags: ["funny moment", "behind the scenes", "music influencer"],
    captions: [],
    targets: [
      {
        id: "target-5",
        platform: "pinterest",
        executionMode: "manual_handoff",
        connectorStatus: "Prepared",
        status: "pending_approval",
        scheduledFor: null,
        externalUrl: null,
        lastError: null,
        captionId: null,
        hashtagSetId: null,
        allowRepost: false,
        manualInstructions: "Convert to Idea Pin or standard Pin after human approval."
      }
    ]
  }
];

const demoJobs: PublishJobSummary[] = [
  {
    id: "job-1",
    platform: "tiktok",
    status: "scheduled",
    runAt: "2026-03-31T16:00:00.000Z",
    completedAt: null,
    attemptCount: 0,
    workerNotes: "Waiting on scheduled window.",
    assetTitle: "Double-Kick Warmup Burst"
  },
  {
    id: "job-2",
    platform: "youtube_shorts",
    status: "manual_action_required",
    runAt: "2026-03-30T21:00:00.000Z",
    completedAt: null,
    attemptCount: 1,
    workerNotes: "Prepared manual handoff because live OAuth is not linked.",
    assetTitle: "Livestream Fill Breakdown"
  }
];

const demoAttempts: PublishAttemptSummary[] = [
  {
    id: "attempt-1",
    platform: "youtube_shorts",
    status: "manual_handoff",
    responseExcerpt: "Prepared Studio upload packet with title, caption, and thumbnail guidance.",
    startedAt: "2026-03-30T15:20:00.000Z",
    finishedAt: "2026-03-30T15:20:04.000Z",
    assetTitle: "Livestream Fill Breakdown"
  },
  {
    id: "attempt-2",
    platform: "instagram",
    status: "queued",
    responseExcerpt: "Asset staged for approval review.",
    startedAt: "2026-03-30T14:00:00.000Z",
    finishedAt: "2026-03-30T14:00:01.000Z",
    assetTitle: "Double-Kick Warmup Burst"
  }
];

const demoLogs: AuditLogSummary[] = [
  {
    id: "log-1",
    severity: "warning",
    eventType: "duplicate_check",
    entityType: "media_assets",
    message: "Livestream Fill Breakdown is visually similar to an earlier Twitch export. Manual override recommended before re-posting.",
    createdAt: "2026-03-30T14:12:00.000Z"
  },
  {
    id: "log-2",
    severity: "info",
    eventType: "publish_job_prepared",
    entityType: "publish_jobs",
    message: "Manual TikTok and Instagram handoff packets generated for Double-Kick Warmup Burst.",
    createdAt: "2026-03-30T15:10:00.000Z"
  }
];

export function buildDemoDashboardSnapshot(): DashboardSnapshot {
  return {
    mode: "demo",
    user: DEMO_USER,
    policies: demoPolicies,
    accounts: demoAccounts,
    assets: demoAssets,
    jobs: demoJobs,
    attempts: demoAttempts,
    auditLogs: demoLogs
  };
}

