import MediaAssetEditor from "@/app/admin/media-asset-editor";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminMediaAsset } from "@/lib/media-repo";

export const dynamic = "force-dynamic";

export default async function AdminMediaEditPage({ params, searchParams }) {
  await requireAdmin();

  const routeParams = await params;
  const query = (await searchParams) || {};
  const returnTo = String(query.returnTo || "/admin/media").trim();

  try {
    const item = await getAdminMediaAsset(routeParams.id);

    return (
      <div className="admin-shell admin-shell--editor">
        <MediaAssetEditor item={item} returnTo={returnTo} />
      </div>
    );
  } catch (error) {
    return (
      <div className="admin-shell admin-shell--editor">
        <section className="admin-list-card">
          <div className="admin-list-header">
            <div>
              <p className="admin-kicker">Media Editor</p>
              <h2>Unable to load this asset</h2>
              <p>{error instanceof Error ? error.message : "The editor could not load the selected item."}</p>
            </div>
            <div className="admin-header-actions">
              <a className="admin-ghost-button" href={returnTo}>Back to library</a>
            </div>
          </div>
        </section>
      </div>
    );
  }
}
