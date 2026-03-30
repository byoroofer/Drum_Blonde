import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { DEMO_USER } from "@/core/demo-data";
import { isDemoMode } from "@/core/env";
import { createSupabaseAdminClient, createSupabaseAnonClient } from "@/core/supabase";
import type { DashboardUser } from "@/core/types";

const ACCESS_COOKIE = "brooke_dist_access";
const REFRESH_COOKIE = "brooke_dist_refresh";

function buildDashboardUser(user: User, role = "owner"): DashboardUser {
  return {
    id: user.id,
    email: user.email ?? "unknown@example.com",
    displayName: (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "Operator",
    role: role as DashboardUser["role"],
    mode: "supabase"
  };
}

async function resolveRole(userId: string) {
  const admin = createSupabaseAdminClient();
  const membership = await admin
    .from("creator_memberships")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membership.error) {
    throw new Error(membership.error.message);
  }

  return membership.data?.role ?? "viewer";
}

async function refreshSession(refreshToken: string) {
  const anon = createSupabaseAnonClient();
  const refreshed = await anon.auth.refreshSession({ refresh_token: refreshToken });
  if (refreshed.error || !refreshed.data.session) {
    return null;
  }

  const store = await cookies();
  store.set(ACCESS_COOKIE, refreshed.data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  store.set(REFRESH_COOKIE, refreshed.data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return refreshed.data.session.access_token;
}

export async function loginWithPassword(email: string, password: string) {
  if (isDemoMode()) {
    return { ok: true, user: DEMO_USER };
  }

  const anon = createSupabaseAnonClient();
  const result = await anon.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session || !result.data.user) {
    return { ok: false, message: result.error?.message || "Unable to sign in." };
  }

  const store = await cookies();
  store.set(ACCESS_COOKIE, result.data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  store.set(REFRESH_COOKIE, result.data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  const role = await resolveRole(result.data.user.id);
  return { ok: true, user: buildDashboardUser(result.data.user, role) };
}

export async function logout() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getCurrentUser() {
  if (isDemoMode()) {
    return DEMO_USER;
  }

  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value || "";
  const refreshToken = store.get(REFRESH_COOKIE)?.value || "";

  if (!accessToken && refreshToken) {
    accessToken = (await refreshSession(refreshToken)) ?? "";
  }

  if (!accessToken) {
    return null;
  }

  const anon = createSupabaseAnonClient();
  const userResult = await anon.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) {
    if (!refreshToken) {
      return null;
    }

    const nextAccessToken = await refreshSession(refreshToken);
    if (!nextAccessToken) {
      return null;
    }

    const retried = await anon.auth.getUser(nextAccessToken);
    if (retried.error || !retried.data.user) {
      return null;
    }

    const role = await resolveRole(retried.data.user.id);
    return buildDashboardUser(retried.data.user, role);
  }

  const role = await resolveRole(userResult.data.user.id);
  return buildDashboardUser(userResult.data.user, role);
}

export async function requireDashboardUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin")}`);
  }

  return user;
}

