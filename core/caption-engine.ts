import type { Platform, VoicePreset } from "@/core/types";

interface CaptionInput {
  title: string;
  description: string;
  tags: string[];
  voicePreset: VoicePreset;
}

const voiceLead: Record<VoicePreset, string> = {
  playful: "Tiny chaos, tight pocket, big grin.",
  drummer_girl: "Built around feel, timing, and drum-first energy.",
  confident: "Locked in and loud on purpose.",
  flirty_safe: "Clean look, sharp groove, still all about the performance.",
  livestream_growth: "Clip from the stream lane that keeps the room moving."
};

const platformCtas: Record<Platform, string> = {
  tiktok: "Save it if the groove hit.",
  instagram: "Comment the fill you want broken down next.",
  youtube_shorts: "Subscribe for the next breakdown.",
  twitch: "Catch the next live session.",
  reddit: "Posting for feedback from drummers who care about feel.",
  x: "Tell me which section deserves the full take.",
  facebook: "Share this with the drummer in your group chat.",
  pinterest: "Pin this for your next practice session."
};

const platformTagPresets: Record<Platform, string[]> = {
  tiktok: ["drumtok", "drummergirl", "musiccreator"],
  instagram: ["drums", "reels", "womenwhoplay"],
  youtube_shorts: ["drums", "shorts", "music"],
  twitch: ["twitchdrums", "livestream", "musiccreator"],
  reddit: ["drums", "practice", "feedback"],
  x: ["drums", "musiccreator", "groove"],
  facebook: ["drums", "musicvideo", "creator"],
  pinterest: ["drums", "practiceideas", "musiccontent"]
};

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueTags(values: string[]) {
  return [...new Set(values.map((value) => value.toLowerCase()).filter(Boolean))];
}

export function buildCaptionVariants(input: CaptionInput, platforms: Platform[]) {
  return platforms.flatMap((platform) => {
    const hashtags = uniqueTags([...platformTagPresets[platform], ...input.tags]).slice(0, 8);
    const base = `${voiceLead[input.voicePreset]} ${input.description || input.title}`.trim();
    const firstVariant = {
      platform,
      variantName: "Primary",
      titleText: `${input.title} | ${toTitleCase(platform.replace("_", " "))}`,
      captionText: base,
      callToAction: platformCtas[platform],
      hashtags
    };
    const secondVariant = {
      platform,
      variantName: "Community",
      titleText: `${input.title} | Brooke Drum Clip`,
      captionText: `${input.title} with a ${input.tags[0] ? `${toTitleCase(input.tags[0])} ` : ""}angle. ${platformCtas[platform]}`,
      callToAction: "Keep the next clip in rotation.",
      hashtags: hashtags.slice().reverse()
    };

    return [firstVariant, secondVariant];
  });
}

