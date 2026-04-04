function readEnv(name) {
  return String(process.env[name] || "").trim();
}

export function getPlatformConfig() {
  return {
    supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseMediaBucket: readEnv("SUPABASE_MEDIA_BUCKET") || "drum-media",
    supabaseMediaPublicUrls: readEnv("SUPABASE_MEDIA_PUBLIC_URLS") === "true",
    adminUsername: readEnv("ADMIN_USERNAME"),
    adminPassword: readEnv("ADMIN_PASSWORD"),
    adminSessionSecret: readEnv("ADMIN_SESSION_SECRET"),
    googleClientId: readEnv("GOOGLE_CLIENT_ID") || readEnv("GOOGLE_OAUTH_CLIENT_ID"),
    googleClientSecret: readEnv("GOOGLE_CLIENT_SECRET") || readEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    googlePhotosAccessToken: readEnv("GOOGLE_PHOTOS_ACCESS_TOKEN"),
    googlePhotosRefreshToken: readEnv("GOOGLE_PHOTOS_REFRESH_TOKEN"),
    googleOauthClientId: readEnv("GOOGLE_OAUTH_CLIENT_ID") || readEnv("GOOGLE_CLIENT_ID"),
    googleOauthClientSecret: readEnv("GOOGLE_OAUTH_CLIENT_SECRET") || readEnv("GOOGLE_CLIENT_SECRET"),
    openAiApiKey: readEnv("OPENAI_API_KEY")
  };
}

export function hasSupabaseUrl() {
  return Boolean(getPlatformConfig().supabaseUrl);
}

export function hasSupabaseAnonKey() {
  return Boolean(getPlatformConfig().supabaseAnonKey);
}

export function hasSupabaseServiceRoleKey() {
  return Boolean(getPlatformConfig().supabaseServiceRoleKey);
}

export function hasDatabase() {
  return hasSupabaseUrl() && hasSupabaseServiceRoleKey();
}

export function hasBlobStore() {
  return hasDatabase();
}

export function buildStorageRequirements() {
  const missing = [];

  if (!hasSupabaseUrl()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!hasSupabaseAnonKey()) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!hasSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function hasAdminCredentials() {
  const config = getPlatformConfig();
  return Boolean(
    config.adminUsername &&
      config.adminPassword &&
      config.adminSessionSecret
  );
}

export function hasGooglePhotosAccess() {
  const config = getPlatformConfig();
  return Boolean(
    config.googlePhotosAccessToken ||
      (config.googlePhotosRefreshToken && config.googleOauthClientId && config.googleOauthClientSecret)
  );
}

export function hasModerationApi() {
  return Boolean(getPlatformConfig().openAiApiKey);
}

export function getStorageSetupStatus() {
  const missing = buildStorageRequirements();

  return {
    ready: missing.length === 0,
    missing
  };
}

export function getGooglePhotosSetupStatus() {
  const missingRequired = [];
  const missingOptional = [];
  const config = getPlatformConfig();
  const googleClientId = config.googleClientId || config.googleOauthClientId;
  const googleClientSecret = config.googleClientSecret || config.googleOauthClientSecret;

  const hasDirectAccess = Boolean(config.googlePhotosAccessToken);
  const hasRefreshPath = Boolean(
    config.googlePhotosRefreshToken && googleClientId && googleClientSecret
  );

  if (!hasDirectAccess && !hasRefreshPath) {
    if (!config.googlePhotosAccessToken && !config.googlePhotosRefreshToken) {
      missingRequired.push("GOOGLE_PHOTOS_ACCESS_TOKEN or GOOGLE_PHOTOS_REFRESH_TOKEN");
    }

    if (config.googlePhotosRefreshToken || !config.googlePhotosAccessToken) {
      if (!googleClientId) {
        missingRequired.push("GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID");
      }

      if (!googleClientSecret) {
        missingRequired.push("GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET");
      }
    }
  }

  if (!config.openAiApiKey) {
    missingOptional.push("OPENAI_API_KEY");
  }

  return {
    ready: missingRequired.length === 0,
    missingRequired,
    missingOptional
  };
}

