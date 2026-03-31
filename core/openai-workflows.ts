import { env } from "@/core/env";
import { buildCaptionVariants } from "@/core/caption-engine";
import type { Platform, VoicePreset } from "@/core/types";

interface WorkflowInput {
  title: string;
  description: string;
  tags: string[];
  voicePreset: VoicePreset;
  platforms: Platform[];
}

interface AiCaptionDraft {
  platform: Platform;
  variantName: string;
  titleText: string;
  captionText: string;
  callToAction: string;
  hashtags: string[];
}

interface AiWorkflowBundle {
  summary: string;
  reviewNotes: string[];
  captions: AiCaptionDraft[];
}

interface ResponsesApiPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "reviewNotes", "captions"],
  properties: {
    summary: { type: "string" },
    reviewNotes: {
      type: "array",
      items: { type: "string" },
      maxItems: 4
    },
    captions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "variantName", "titleText", "captionText", "callToAction", "hashtags"],
        properties: {
          platform: { type: "string" },
          variantName: { type: "string" },
          titleText: { type: "string" },
          captionText: { type: "string" },
          callToAction: { type: "string" },
          hashtags: {
            type: "array",
            items: { type: "string" },
            maxItems: 8
          }
        }
      }
    }
  }
} as const;

function isValidPlatform(value: string): value is Platform {
  return ["tiktok", "instagram", "youtube_shorts", "twitch", "reddit", "x", "facebook", "pinterest"].includes(value);
}

function uniqueHashtags(values: string[]) {
  return [...new Set(values.map((value) => String(value || "").trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 8);
}

function readOutputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = (payload.output || []).flatMap((item) => item.content || [])
    .filter((entry) => entry.type === "output_text" && typeof entry.text === "string")
    .map((entry) => String(entry.text || "").trim())
    .filter(Boolean);

  return parts.join("\n").trim();
}

function normalizeAiBundle(bundle: AiWorkflowBundle, platforms: Platform[]) {
  const allowedPlatforms = new Set(platforms);
  const captions = bundle.captions
    .filter((caption) => isValidPlatform(caption.platform) && allowedPlatforms.has(caption.platform))
    .map((caption) => ({
      platform: caption.platform,
      variantName: String(caption.variantName || "Primary").trim() || "Primary",
      titleText: String(caption.titleText || "").trim(),
      captionText: String(caption.captionText || "").trim(),
      callToAction: String(caption.callToAction || "").trim(),
      hashtags: uniqueHashtags(caption.hashtags || [])
    }))
    .filter((caption) => caption.titleText && caption.captionText)
    .slice(0, Math.max(2, platforms.length * 2));

  return {
    summary: String(bundle.summary || "").trim(),
    reviewNotes: (bundle.reviewNotes || []).map((note) => String(note || "").trim()).filter(Boolean).slice(0, 4),
    captions
  };
}

export function hasOpenAIWorkflowSupport() {
  return Boolean(env.openaiApiKey);
}

export async function generateWorkflowBundle(input: WorkflowInput) {
  if (!env.openaiApiKey || !input.platforms.length) {
    return null;
  }

  const requestBody = {
    model: env.openaiModel,
    store: false,
    reasoning: {
      effort: "medium"
    },
    text: {
      format: {
        type: "json_schema",
        name: "distribution_workflow_bundle",
        strict: true,
        schema: RESPONSE_SCHEMA
      }
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You create concise, platform-aware social distribution plans for a drummer and music creator. Keep outputs safe for official platform use, avoid invented claims, avoid sexual content, and keep the creator voice confident, music-first, and brand-safe."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Create exactly two caption variants per requested platform: one primary and one community variant. Use the supplied title, description, tags, and voice preset. Return short review notes for a human approver. Input JSON: ${JSON.stringify(input)}`
          }
        ]
      }
    ]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(45_000)
  });

  const payload = await response.json() as ResponsesApiPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI workflow generation failed with status ${response.status}.`);
  }

  const outputText = readOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI workflow generation returned no structured output.");
  }

  const parsed = JSON.parse(outputText) as AiWorkflowBundle;
  const normalized = normalizeAiBundle(parsed, input.platforms);
  if (!normalized.captions.length) {
    throw new Error("OpenAI workflow generation returned no usable captions.");
  }

  return {
    model: env.openaiModel,
    summary: normalized.summary,
    reviewNotes: normalized.reviewNotes,
    captions: normalized.captions
  };
}

export function buildCaptionBlueprint(input: WorkflowInput) {
  return buildCaptionVariants(
    {
      title: input.title,
      description: input.description,
      tags: input.tags,
      voicePreset: input.voicePreset
    },
    input.platforms
  );
}
