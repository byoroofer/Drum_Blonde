function readEnv(name: string) {
  return String(process.env[name] ?? "").trim();
}

function readBoolean(name: string, fallback = false) {
  const value = readEnv(name).toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes";
}

export const env = {
  appUrl: readEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  storageBucket: readEnv("SUPABASE_STORAGE_BUCKET") || "creator-media",
  storagePublic: readBoolean("SUPABASE_STORAGE_PUBLIC", false),
  databaseUrl: readEnv("DATABASE_URL"),
  defaultCreatorSlug: readEnv("DEFAULT_CREATOR_SLUG") || "brooke-drums",
  tokenEncryptionKey: readEnv("TOKEN_ENCRYPTION_KEY"),
  workerSharedSecret: readEnv("WORKER_SHARED_SECRET"),
  livePublishingEnabled: readBoolean("PUBLISHER_ENABLE_LIVE_WRITES", false),
  metaAppId: readEnv("META_APP_ID"),
  metaAppSecret: readEnv("META_APP_SECRET"),
  googleClientId: readEnv("GOOGLE_CLIENT_ID") || readEnv("GOOGLE_OAUTH_CLIENT_ID"),
  googleClientSecret: readEnv("GOOGLE_CLIENT_SECRET") || readEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
  googlePhotosAccessToken: readEnv("GOOGLE_PHOTOS_ACCESS_TOKEN"),
  googlePhotosRefreshToken: readEnv("GOOGLE_PHOTOS_REFRESH_TOKEN"),
  openAiApiKey: readEnv("OPENAI_API_KEY"),
  tiktokClientKey: readEnv("TIKTOK_CLIENT_KEY"),
  tiktokClientSecret: readEnv("TIKTOK_CLIENT_SECRET"),
  xClientId: readEnv("X_CLIENT_ID"),
  xClientSecret: readEnv("X_CLIENT_SECRET"),
  pinterestAppId: readEnv("PINTEREST_APP_ID"),
  pinterestAppSecret: readEnv("PINTEREST_APP_SECRET"),
  redditClientId: readEnv("REDDIT_CLIENT_ID"),
  redditClientSecret: readEnv("REDDIT_CLIENT_SECRET"),
  twitchClientId: readEnv("TWITCH_CLIENT_ID"),
  twitchClientSecret: readEnv("TWITCH_CLIENT_SECRET")
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey);
}

export function isDemoMode() {
  return !hasSupabaseEnv();
}

export function getGooglePhotosPickerStatus() {
  const missing: string[] = [];

  if (!env.googleClientId) {
    missing.push("GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID");
  }

  if (!env.googleClientSecret) {
    missing.push("GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET");
  }

  if (!env.googlePhotosRefreshToken && !env.googlePhotosAccessToken) {
    missing.push("GOOGLE_PHOTOS_ACCESS_TOKEN or GOOGLE_PHOTOS_REFRESH_TOKEN");
  }

  return {
    ready: missing.length === 0,
    missing
  };
}

export function getEnvironmentChecklist() {
  const googlePhotosPicker = getGooglePhotosPickerStatus();

  return [
    { name: "NEXT_PUBLIC_APP_URL", configured: Boolean(env.appUrl), required: true, purpose: "App callbacks and manual handoff links." },
    { name: "NEXT_PUBLIC_SUPABASE_URL", configured: Boolean(env.supabaseUrl), required: true, purpose: "Supabase API endpoint." },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", configured: Boolean(env.supabaseAnonKey), required: true, purpose: "Supabase Auth client login." },
    { name: "SUPABASE_SERVICE_ROLE_KEY", configured: Boolean(env.supabaseServiceRoleKey), required: true, purpose: "Server-side storage, queue, and audit actions." },
    { name: "SUPABASE_STORAGE_BUCKET", configured: Boolean(env.storageBucket), required: true, purpose: "Originals and generated versions bucket." },
    { name: "DATABASE_URL", configured: Boolean(env.databaseUrl), required: true, purpose: "Local schema application." },
    { name: "TOKEN_ENCRYPTION_KEY", configured: Boolean(env.tokenEncryptionKey), required: true, purpose: "AES-GCM envelope for platform tokens." },
    { name: "WORKER_SHARED_SECRET", configured: Boolean(env.workerSharedSecret), required: true, purpose: "Protects the publish worker endpoint." },
    { name: "META_APP_ID", configured: Boolean(env.metaAppId), required: false, purpose: "Future Instagram/Facebook official OAuth." },
    { name: "META_APP_SECRET", configured: Boolean(env.metaAppSecret), required: false, purpose: "Future Instagram/Facebook token exchange." },
    { name: "GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID", configured: Boolean(env.googleClientId), required: false, purpose: "Google OAuth client for YouTube and Google Photos Picker." },
    { name: "GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET", configured: Boolean(env.googleClientSecret), required: false, purpose: "Google OAuth client secret for YouTube and Google Photos Picker." },
    { name: "GOOGLE_PHOTOS_ACCESS_TOKEN or GOOGLE_PHOTOS_REFRESH_TOKEN", configured: Boolean(env.googlePhotosRefreshToken || env.googlePhotosAccessToken), required: false, purpose: "Google Photos Picker import. Must be minted with photospicker.mediaitems.readonly." },
    { name: "OPENAI_API_KEY", configured: Boolean(env.openAiApiKey), required: false, purpose: "Optional smart-import captioning and metadata enrichment." },
    { name: "TIKTOK_CLIENT_KEY", configured: Boolean(env.tiktokClientKey), required: false, purpose: "Future TikTok Content Posting API OAuth." },
    { name: "TIKTOK_CLIENT_SECRET", configured: Boolean(env.tiktokClientSecret), required: false, purpose: "Future TikTok Content Posting API OAuth." },
    { name: "X_CLIENT_ID", configured: Boolean(env.xClientId), required: false, purpose: "Future X API OAuth." },
    { name: "X_CLIENT_SECRET", configured: Boolean(env.xClientSecret), required: false, purpose: "Future X API OAuth." },
    { name: "PINTEREST_APP_ID", configured: Boolean(env.pinterestAppId), required: false, purpose: "Future Pinterest official publishing." },
    { name: "PINTEREST_APP_SECRET", configured: Boolean(env.pinterestAppSecret), required: false, purpose: "Future Pinterest official publishing." },
    { name: "REDDIT_CLIENT_ID", configured: Boolean(env.redditClientId), required: false, purpose: "Reddit manual-helper integrations and subreddit posting tools." },
    { name: "REDDIT_CLIENT_SECRET", configured: Boolean(env.redditClientSecret), required: false, purpose: "Reddit manual-helper integrations and subreddit posting tools." },
    { name: "TWITCH_CLIENT_ID", configured: Boolean(env.twitchClientId), required: false, purpose: "Future Twitch clip ingestion." },
    { name: "TWITCH_CLIENT_SECRET", configured: Boolean(env.twitchClientSecret), required: false, purpose: "Future Twitch clip ingestion." }
  ];
}
