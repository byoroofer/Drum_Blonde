"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertLoginAllowed,
  clearAdminSession,
  clearFailedLoginAttempts,
  createAdminSession,
  registerFailedLoginAttempt,
  requireAdmin,
  verifyAdminCredentials
} from "@/lib/admin-auth";
import { hasAdminCredentials } from "@/lib/env";
import {
  createMediaAlbum,
  deleteMediaAsset,
  updateMediaAsset,
  updateMediaEngineConfig
} from "@/lib/media-repo";

function normalizeAdminReturnTo(value) {
  const fallback = "/admin";
  const input = String(value || "").trim();
  return input.startsWith("/admin") ? input : fallback;
}

function buildAdminRedirectUrl(returnTo, params) {
  const [pathname, search = ""] = normalizeAdminReturnTo(returnTo).split("?");
  const nextParams = new URLSearchParams(search);

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      nextParams.delete(key);
      continue;
    }

    nextParams.set(key, String(value));
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function loginAction(formData) {
  if (!hasAdminCredentials()) {
    redirect("/admin/login?error=setup");
  }

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!(await assertLoginAllowed(username))) {
    redirect("/admin/login?error=locked");
  }

  if (!verifyAdminCredentials(username, password)) {
    await registerFailedLoginAttempt(username);
    redirect("/admin/login?error=invalid");
  }

  await clearFailedLoginAttempts(username);
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function updateMediaAction(formData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const returnTo = normalizeAdminReturnTo(formData.get("returnTo"));

  try {
    await updateMediaAsset({
      id,
      title: String(formData.get("title") || "Untitled asset"),
      description: String(formData.get("description") || ""),
      tags: String(formData.get("tags") || ""),
      moderationStatus: String(formData.get("workflowStatus") || formData.get("moderationStatus") || "approved"),
      overrideStatus: String(formData.get("overrideStatus") || ""),
      overrideBy: String(formData.get("overrideBy") || ""),
      overrideNotes: String(formData.get("overrideNotes") || ""),
      featuredHome: formData.get("featuredHome") === "on",
      active: formData.get("active") === "on",
      isHidden: formData.get("isHidden") === "on",
      albumSlugs: formData.getAll("albumSlugs").map((value) => String(value || "")).filter(Boolean),
      homeSlot: String(formData.get("homeSlot") || ""),
      manualRank: String(formData.get("manualRank") || "0")
    });
  } catch (error) {
    redirect(
      buildAdminRedirectUrl(returnTo, {
        save: "error",
        media: id,
        reason: error instanceof Error ? error.message : "Save failed."
      })
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(buildAdminRedirectUrl(returnTo, { save: "success", media: id, reason: null }));
}

export async function createAlbumAction(formData) {
  await requireAdmin();

  const returnTo = normalizeAdminReturnTo(formData.get("returnTo"));

  try {
    await createMediaAlbum({
      name: String(formData.get("name") || ""),
      slug: String(formData.get("slug") || ""),
      description: String(formData.get("description") || "")
    });
  } catch (error) {
    redirect(
      buildAdminRedirectUrl(returnTo, {
        save: "error",
        reason: error instanceof Error ? error.message : "Album creation failed."
      })
    );
  }

  revalidatePath("/admin");
  redirect(buildAdminRedirectUrl(returnTo, { save: "album", reason: null }));
}

export async function toggleFeaturedHomeAction(formData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const returnTo = normalizeAdminReturnTo(formData.get("returnTo"));
  const featuredHome = formData.get("featuredHome") === "true";

  try {
    await updateMediaAsset({ id, featuredHome });
  } catch (error) {
    redirect(
      buildAdminRedirectUrl(returnTo, {
        save: "error",
        media: id,
        reason: error instanceof Error ? error.message : "Featured state update failed."
      })
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(buildAdminRedirectUrl(returnTo, { save: featuredHome ? "featured" : "unfeatured", media: id, reason: null }));
}

export async function toggleHiddenAction(formData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const returnTo = normalizeAdminReturnTo(formData.get("returnTo"));
  const isHidden = formData.get("isHidden") === "true";

  try {
    await updateMediaAsset({ id, isHidden });
  } catch (error) {
    redirect(
      buildAdminRedirectUrl(returnTo, {
        save: "error",
        media: id,
        reason: error instanceof Error ? error.message : "Hidden state update failed."
      })
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(buildAdminRedirectUrl(returnTo, { save: isHidden ? "hidden" : "unhidden", media: id, reason: null }));
}

export async function deleteMediaAction(formData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const returnTo = normalizeAdminReturnTo(formData.get("returnTo"));

  try {
    await deleteMediaAsset(id);
  } catch (error) {
    redirect(
      buildAdminRedirectUrl(returnTo, {
        save: "error",
        media: id,
        reason: error instanceof Error ? error.message : "Delete failed."
      })
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(buildAdminRedirectUrl(returnTo, { save: "deleted", media: id, edit: null, reason: null }));
}

export async function updateFilterConfigAction(formData) {
  await requireAdmin();

  const returnTo = normalizeAdminReturnTo(formData.get("returnTo"));

  try {
    await updateMediaEngineConfig({
      enabled: formData.get("enabled") === "on",
      nsfw_detection: formData.get("nsfw_detection") === "on",
      face_detection: formData.get("face_detection") === "on",
      object_detection: formData.get("object_detection") === "on",
      strict_mode: formData.get("strict_mode") === "on",
      show_hidden_media: formData.get("show_hidden_media") === "on"
    });
  } catch (error) {
    redirect(
      buildAdminRedirectUrl(returnTo, {
        save: "error",
        reason: error instanceof Error ? error.message : "Config update failed."
      })
    );
  }

  revalidatePath("/admin");
  redirect(buildAdminRedirectUrl(returnTo, { save: "config", reason: null }));
}

// No-redirect variants for client-side tile actions (no scroll jump)
export async function toggleFeaturedHomeSilent(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const featuredHome = formData.get("featuredHome") === "true";
  await updateMediaAsset({ id, featuredHome });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function toggleHiddenSilent(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const isHidden = formData.get("isHidden") === "true";
  await updateMediaAsset({ id, isHidden });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteMediaSilent(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  await deleteMediaAsset(id);
  revalidatePath("/");
  revalidatePath("/admin");
}
