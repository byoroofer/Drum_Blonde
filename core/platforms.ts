import type { ExecutionMode, Platform, PlatformPolicy } from "@/core/types";

interface PlatformDescriptor extends PlatformPolicy {
  defaultExecutionMode: ExecutionMode;
  destinationsAllowed: boolean;
}

export const PLATFORM_CATALOG: Record<Platform, PlatformDescriptor> = {
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    direction: "both",
    officialAutomation: "Official Content Posting API supports creator-authorized posting and drafts.",
    mvpExecution: "Manual handoff by default until OAuth, token refresh, and app review are completed.",
    notes: "Use only Brooke-owned accounts and approved scopes. Safe fallback is prepared draft/manual publish.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  },
  instagram: {
    platform: "instagram",
    label: "Instagram",
    direction: "both",
    officialAutomation: "Official Instagram Graph API supports publishing for eligible professional/business accounts.",
    mvpExecution: "Manual handoff in this MVP pending Meta OAuth, account linking, and permission review.",
    notes: "Treat Reels publishing as eligible only for approved account types and permissions.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  },
  youtube_shorts: {
    platform: "youtube_shorts",
    label: "YouTube Shorts",
    direction: "both",
    officialAutomation: "Official YouTube Data API supports video uploads; Shorts are standard uploads with short-form formatting.",
    mvpExecution: "Manual handoff in this MVP pending Google OAuth and resumable upload wiring.",
    notes: "Use official YouTube upload scopes and respect channel ownership.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  },
  twitch: {
    platform: "twitch",
    label: "Twitch Clips",
    direction: "both",
    officialAutomation: "Official APIs are strong for clip creation and retrieval, not for cross-post destination publishing.",
    mvpExecution: "Source ingest only. Use Twitch as an official source lane, not an auto-publish destination.",
    notes: "Treat clips/highlights as ingestion sources and export candidates.",
    defaultExecutionMode: "source_only",
    destinationsAllowed: false
  },
  reddit: {
    platform: "reddit",
    label: "Reddit",
    direction: "both",
    officialAutomation: "Official posting endpoints exist, but subreddit rules, media limitations, and moderation expectations vary heavily.",
    mvpExecution: "Manual handoff only. The system prepares title options, media, and subreddit notes.",
    notes: "Keep a human in the loop for subreddit selection and final posting.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  },
  x: {
    platform: "x",
    label: "X",
    direction: "both",
    officialAutomation: "Official APIs support media upload plus Post creation.",
    mvpExecution: "Manual handoff in this MVP pending OAuth and paid-plan production credentials.",
    notes: "Respect rate limits, paid access terms, and owner authorization.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  },
  facebook: {
    platform: "facebook",
    label: "Facebook Pages",
    direction: "both",
    officialAutomation: "Official Meta APIs support publishing to eligible Page surfaces.",
    mvpExecution: "Manual handoff in this MVP pending Meta Page token exchange and permission review.",
    notes: "Page-only; do not automate personal-profile posting.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  },
  pinterest: {
    platform: "pinterest",
    label: "Pinterest",
    direction: "both",
    officialAutomation: "Official Pinterest APIs support Pin creation for approved apps and accounts.",
    mvpExecution: "Manual handoff in this MVP pending Pinterest OAuth and media upload flow wiring.",
    notes: "Useful mainly for evergreen clips, tutorials, and glam/lifestyle recuts.",
    defaultExecutionMode: "manual_handoff",
    destinationsAllowed: true
  }
};

export function getDestinationPlatforms() {
  return Object.values(PLATFORM_CATALOG).filter((item) => item.destinationsAllowed);
}

export function getPlatformPolicyList() {
  return Object.values(PLATFORM_CATALOG);
}

