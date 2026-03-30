import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loginWithPassword, logout, requireDashboardUser } from "@/core/auth";
import { ingestMedia, queueAssetTargets, reviewAsset, runQueuedJobs } from "@/core/repository";

function buildAdminRedirect(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `/admin?${query}` : "/admin";
}

export async function loginAction(formData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const result = await loginWithPassword(email, password);
  if (!result.ok) {
    redirect(`/admin/login?error=${encodeURIComponent(result.message || "Unable to sign in.")}`);
  }
  redirect("/admin");
}

export async function logoutAction() {
  "use server";
  await logout();
  redirect("/admin/login");
}

export async function ingestMediaAction(formData) {
  "use server";
  const actor = await requireDashboardUser();
  const file = formData.get("media");
  if (!(file instanceof File) || !file.size) {
    redirect(buildAdminRedirect({ tab: "library", error: "Select a media file first." }));
  }

  const result = await ingestMedia({
    actor,
    file,
    title: String(formData.get("title") || file.name || "Untitled asset").trim(),
    description: String(formData.get("description") || "").trim(),
    sourcePlatform: String(formData.get("sourcePlatform") || "upload"),
    sourceUrl: String(formData.get("sourceUrl") || "").trim() || null,
    creatorNotes: String(formData.get("creatorNotes") || "").trim() || null,
    campaign: String(formData.get("campaign") || "").trim() || null,
    voicePreset: String(formData.get("voicePreset") || "drummer_girl"),
    tags: String(formData.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    destinations: formData.getAll("destinations").map((value) => String(value)),
    scheduledFor: String(formData.get("scheduledFor") || "").trim() ? new Date(String(formData.get("scheduledFor"))).toISOString() : null,
    approvalPolicy: String(formData.get("approvalPolicy") || "human_required")
  });

  revalidatePath("/admin");
  redirect(buildAdminRedirect({ tab: "library", notice: result.notice || "uploaded" }));
}

export async function reviewAssetAction(formData) {
  "use server";
  const actor = await requireDashboardUser();
  const assetId = String(formData.get("assetId") || "").trim();
  const decision = String(formData.get("decision") || "approved");
  const result = await reviewAsset(assetId, decision, actor);
  revalidatePath("/admin");
  redirect(buildAdminRedirect({ tab: "approvals", notice: result.notice || decision }));
}

export async function queueAssetAction(formData) {
  "use server";
  const actor = await requireDashboardUser();
  const assetId = String(formData.get("assetId") || "").trim();
  const result = await queueAssetTargets(assetId, actor);
  revalidatePath("/admin");
  redirect(buildAdminRedirect({ tab: "schedule", notice: result.notice || "queued" }));
}

export async function runJobsAction() {
  "use server";
  await requireDashboardUser();
  await runQueuedJobs(10);
  revalidatePath("/admin");
  redirect(buildAdminRedirect({ tab: "schedule", notice: "worker-ran" }));
}

