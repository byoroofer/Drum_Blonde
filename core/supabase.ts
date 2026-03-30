import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/core/env";

export function createSupabaseAdminClient() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase is not configured.");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createSupabaseAnonClient() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase is not configured.");
  }

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

