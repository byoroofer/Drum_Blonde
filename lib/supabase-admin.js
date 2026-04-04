import { createClient } from "@supabase/supabase-js";
import { getPlatformConfig } from "@/lib/env";

export function createSupabaseAdminClient() {
  const config = getPlatformConfig();

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getMediaBucketName() {
  return getPlatformConfig().supabaseMediaBucket || "drum-media";
}

export function usePublicMediaUrls() {
  return getPlatformConfig().supabaseMediaPublicUrls === true;
}
