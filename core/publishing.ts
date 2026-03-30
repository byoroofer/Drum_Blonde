import { env } from "@/core/env";
import { PLATFORM_CATALOG } from "@/core/platforms";
import type { ConnectedAccountSummary, MediaAssetSummary, Platform, PublishingTargetSummary } from "@/core/types";

export interface PublishExecutionResult {
  status: "published" | "manual_handoff" | "failed";
  message: string;
  manualPayload?: Record<string, unknown>;
}

export function resolveExecutionMode(platform: Platform) {
  return PLATFORM_CATALOG[platform].defaultExecutionMode;
}

export function buildManualPayload(asset: MediaAssetSummary, target: PublishingTargetSummary) {
  const selectedCaption = asset.captions.find((caption) => caption.id === target.captionId) || asset.captions[0] || null;

  return {
    platform: target.platform,
    title: asset.title,
    description: asset.description,
    mediaUrl: asset.publicUrl,
    thumbnailUrl: asset.thumbnailUrl,
    scheduledFor: target.scheduledFor,
    caption: selectedCaption?.captionText ?? asset.description,
    callToAction: selectedCaption?.callToAction ?? null,
    hashtags: selectedCaption?.hashtags ?? [],
    sourceUrl: asset.sourceUrl,
    instructions: target.manualInstructions
  };
}

export async function executePublish(
  asset: MediaAssetSummary,
  target: PublishingTargetSummary,
  connectedAccount?: ConnectedAccountSummary
): Promise<PublishExecutionResult> {
  const descriptor = PLATFORM_CATALOG[target.platform];

  if (descriptor.defaultExecutionMode !== "direct" || !env.livePublishingEnabled || !connectedAccount) {
    return {
      status: "manual_handoff",
      message: `${descriptor.label} stays in prepared-manual mode in this MVP.`,
      manualPayload: buildManualPayload(asset, target)
    };
  }

  return {
    status: "failed",
    message: `${descriptor.label} direct publishing is not enabled in the current build.`
  };
}

