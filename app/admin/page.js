import GooglePhotosImportPanel from "@/app/admin/google-photos-import-panel";
import RemoteUrlImportPanel from "@/app/admin/remote-url-import-panel";
import { createAlbumAction, logoutAction, updateFilterConfigAction } from "@/app/admin/actions";
import UploadWidget from "@/app/admin/upload-widget";
import MediaThumbnail from "@/app/components/media-thumbnail";
import { requireAdmin } from "@/lib/admin-auth";
import { getGooglePhotosSetupStatus, getStorageSetupStatus } from "@/lib/env";
import { getAdminAlbums, getAdminMedia, getDashboardSummary, getHomepageMedia, getMediaEngineConfig } from "@/lib/media-repo";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatDateLabel(value) {
  if (!value) {
    return "Recently updated";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function SummaryCard({ label, value, tone = "default" }) {
  return (
    <article className={`admin-summary-card admin-summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function getThumbnailSrc(item) {
  return item.adminThumbnailUrl || item.storedThumbnailUrl || item.thumbnailUrl || item.posterUrl || "/images/brooke-tiktok-avatar.jpg";
}

function DisclosureCard({ id, kicker, title, note, badge, defaultOpen = true, children }) {
  return (
    <details id={id} className="admin-collapsible admin-collapsible--card" open={defaultOpen}>
      <summary>
        <div className="admin-collapsible__summary">
          <div>
            {kicker ? <p className="admin-kicker">{kicker}</p> : null}
            <h2>{title}</h2>
            {note ? <p>{note}</p> : null}
          </div>
          <div className="admin-collapsible__aside">
            {badge ? <span className="admin-pill">{badge}</span> : null}
            <span className="admin-collapsible__meta">Toggle</span>
          </div>
        </div>
      </summary>
      <div className="admin-collapsible__body">{children}</div>
    </details>
  );
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const proto = headerStore.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "";
}

export default async function AdminPage({ searchParams }) {
  await requireAdmin();

  const params = (await searchParams) || {};
  const saveState = String(params.save || "").toLowerCase();
  const savedMediaId = String(params.media || "").trim();
  const saveReason = String(params.reason || "").trim();
  const storageStatus = getStorageSetupStatus();
  const googleStatus = getGooglePhotosSetupStatus();
  const uploadEnabled = storageStatus.ready;
  const remoteImportEnabled = storageStatus.ready;
  const googleImportEnabled = storageStatus.ready && googleStatus.ready;

  const [mediaItems, albums, summary, homepageMedia, filterConfig, origin] = await Promise.all([
    getAdminMedia(),
    getAdminAlbums(),
    getDashboardSummary(),
    getHomepageMedia(),
    getMediaEngineConfig(),
    getRequestOrigin()
  ]);

  const rotationItems = (homepageMedia.home.featuredVideos || []).filter(Boolean);
  const spotlightLeader = homepageMedia.home.spotlightItem || homepageMedia.home.heroVideo || null;
  let rotationCounter = 0;
  const overriddenItems = mediaItems
    .filter((item) => item.overrideStatus || item.overrideNotes)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
    .slice(0, 5);
  const hiddenItems = mediaItems
    .filter((item) => item.isHidden === true)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
    .slice(0, 5);

  const albumCards = [
    {
      id: "all",
      name: "All Media",
      slug: "all",
      description: "Browse the entire media library.",
      assetCount: mediaItems.length,
      href: "/admin/media",
      shareUrl: origin ? `${origin}/admin/media` : "/admin/media"
    },
    ...albums.map((entry) => ({
      ...entry,
      href: `/admin/media?album=${encodeURIComponent(entry.slug)}`,
      shareUrl: origin ? `${origin}/admin/media?album=${encodeURIComponent(entry.slug)}` : `/admin/media?album=${encodeURIComponent(entry.slug)}`
    }))
  ];

  return (
    <div className="admin-shell">
      <section className="admin-header-card">
        <div>
          <p className="admin-kicker">Admin Control Panel</p>
          <h1>Manage media, homepage features, albums, visibility, and diagnostics from one place.</h1>
          <p>
            The dashboard keeps storage, media processing, and homepage controls visible without burying the library inside a single long page.
          </p>
        </div>

        <div className="admin-header-actions">
          <a className="admin-ghost-button" href="/" target="_blank" rel="noreferrer">Open live homepage</a>
          <a className="admin-ghost-button" href="/admin/media">Open Media Library</a>
          <form action={logoutAction}>
            <button type="submit" className="admin-ghost-button">Sign out</button>
          </form>
        </div>
      </section>

      {saveState ? (
        <section className="admin-alert">
          <strong>
            {saveState === "success" && "Media changes saved."}
            {saveState === "deleted" && "Media removed."}
            {saveState === "config" && "Settings updated."}
            {saveState === "album" && "Album created."}
            {saveState === "hidden" && "Item moved to Hidden."}
            {saveState === "unhidden" && "Item restored from Hidden."}
            {saveState === "featured" && "Item added to homepage features."}
            {saveState === "unfeatured" && "Item removed from homepage features."}
            {saveState === "error" && "Admin action failed."}
          </strong>
          <p>
            {saveState === "error"
              ? saveReason || "The requested update did not complete."
              : savedMediaId
                ? `Item ${savedMediaId} was updated.`
                : "The admin state was updated."}
          </p>
        </section>
      ) : null}

      {!uploadEnabled ? (
        <section className="admin-alert">
          <strong>Storage or database setup is incomplete.</strong>
          <p>{storageStatus.missing.length ? `Missing: ${storageStatus.missing.join(", ")}.` : "Required configuration is not ready."}</p>
        </section>
      ) : null}

      <section className="admin-summary-grid admin-summary-grid--five-up">
        <SummaryCard label="Media Items" value={formatNumber(mediaItems.length)} />
        <SummaryCard label="Starred Videos" value={formatNumber(rotationItems.length)} tone="accent" />
        <SummaryCard label="Albums" value={formatNumber(summary.albumCount || albums.length)} />
        <SummaryCard label="Visible" value={formatNumber(summary.activeCount - summary.hiddenCount)} tone="accent" />
        <SummaryCard label="Hidden" value={formatNumber(summary.hiddenCount)} />
        <SummaryCard label="Approved" value={formatNumber(summary.approvedCount)} />
        <SummaryCard label="In Review" value={formatNumber(summary.reviewCount)} />
        <SummaryCard label="Flagged" value={formatNumber(summary.flaggedCount)} />
        <SummaryCard label="Views" value={formatNumber(summary.totalViews)} />
        <SummaryCard label="Plays" value={formatNumber(summary.totalPlays)} />
      </section>

      <section id="homepage-features" className="admin-board-card">
        <div className="admin-board-grid">
          <DisclosureCard
            kicker="Homepage Features"
            title="Homepage video tiles rotate every five minutes"
            note="Any starred video enters the homepage grid automatically. Spotlight-marked videos rotate through the top spotlight slot every five minutes in ranked order. If no spotlight videos are selected, the most-viewed starred video takes that slot."
            badge={rotationItems.length ? `${rotationItems.length} in rotation` : "No starred videos"}
          >
            <div className="admin-homepage-feature-grid">
              {rotationItems.length ? (
                rotationItems.map((item) => {
                  const isSpotlightSelection = item.spotlightHome === true;
                  const isSpotlightLeader = item.id === spotlightLeader?.id;
                  const rotationLabel = isSpotlightSelection ? "◉" : String((rotationCounter += 1));

                  return (
                    <a
                      key={`tile-${item.id}`}
                      className={`admin-homepage-feature-tile${isSpotlightLeader ? " admin-homepage-feature-tile--leader" : ""}`}
                      href={`/admin/media?view=videos&edit=${encodeURIComponent(item.id)}`}
                    >
                      <MediaThumbnail
                        className="admin-homepage-feature-tile__media"
                        kind={item.kind}
                        alt={item.title || ""}
                        storedThumbnailSrc={item.storedThumbnailUrl}
                        fallbackImageSrc={item.placeholderThumbnailUrl || getThumbnailSrc(item)}
                        videoSrc={item.playbackUrl}
                        durationSeconds={item.durationSeconds}
                        thumbnailBackfillUrl={item.thumbnailBackfillUrl}
                        cacheKey={`${item.id || item.url || "media"}-${item.updatedAt || item.createdAt || "0"}`}
                      />
                      <div className="admin-homepage-feature-tile__overlay">
                        <span className={`admin-homepage-feature-tile__marker${isSpotlightSelection ? " admin-homepage-feature-tile__marker--spotlight" : ""}`}>{rotationLabel}</span>
                        <span className="admin-homepage-feature-tile__status">{isSpotlightLeader ? "Current spotlight" : isSpotlightSelection ? "Spotlight pool" : "Rotation"}</span>
                      </div>
                      <div className="admin-homepage-feature-tile__footer">
                        <strong>{item.title}</strong>
                        <small>{formatNumber(item.views)} views · {formatNumber(item.plays)} plays</small>
                      </div>
                    </a>
                  );
                })
              ) : (
                <p className="admin-note">No starred videos are currently available for homepage rotation.</p>
              )}
            </div>

            {spotlightLeader ? (
              <article className="admin-top-card admin-top-card--spotlight">
                <div>
                  <p className="admin-kicker">Spotlight Leader</p>
                  <strong>{spotlightLeader.title}</strong>
                  <small>
                    {formatNumber(spotlightLeader.views)} views · {formatNumber(spotlightLeader.plays)} plays · Updated {formatDateLabel(spotlightLeader.updatedAt || spotlightLeader.createdAt)}
                  </small>
                </div>
                <div className="admin-badge-row">
                  <span className="admin-pill admin-pill--accent">Pinned spotlight</span>
                  <span className="admin-pill">Starred</span>
                </div>
              </article>
            ) : (
              <p className="admin-note">No starred videos are currently available for homepage rotation.</p>
            )}

            <div className="admin-featured-list">
              {rotationItems.length ? (
                rotationItems.map((item, index) => (
                  <article key={item.id} className="admin-featured-item">
                    <div>
                      <strong>{index + 1}</strong>
                      <span>{item.id === spotlightLeader?.id ? "Spotlight" : "Rotation"}</span>
                    </div>
                    <div>
                      <p>{item.title}</p>
                      <small>{formatNumber(item.views)} views · {formatNumber(item.plays)} plays</small>
                    </div>
                    <div>
                      <strong>{item.homeSlot || "Auto"}</strong>
                      <span>slot</span>
                    </div>
                  </article>
                ))
              ) : null}
            </div>

            <div className="admin-media-actions">
              <a className="admin-ghost-button" href="/admin/media?view=videos">Manage starred videos</a>
            </div>
          </DisclosureCard>

          <DisclosureCard
            id="filters"
            kicker="Media Processing"
            title="Visibility and filtering controls"
            note="Filtering remains metadata-only. Hidden items stay attached to albums and can be restored without losing organization."
            badge={filterConfig.enabled ? "Processing on" : "Processing off"}
          >
            <form action={updateFilterConfigAction} className="admin-form-stack">
              <input type="hidden" name="returnTo" value="/admin#filters" />
              <label className="admin-check">
                <input name="enabled" type="checkbox" defaultChecked={filterConfig.enabled} />
                <span>Enable media processing rules</span>
              </label>
              <label className="admin-check">
                <input name="nsfw_detection" type="checkbox" defaultChecked={filterConfig.nsfw_detection} />
                <span>Flag sensitive content terms</span>
              </label>
              <label className="admin-check">
                <input name="face_detection" type="checkbox" defaultChecked={filterConfig.face_detection} />
                <span>Enable face detection tagging</span>
              </label>
              <label className="admin-check">
                <input name="object_detection" type="checkbox" defaultChecked={filterConfig.object_detection} />
                <span>Enable object detection tagging</span>
              </label>
              <label className="admin-check">
                <input name="strict_mode" type="checkbox" defaultChecked={filterConfig.strict_mode} />
                <span>Hide flagged items automatically</span>
              </label>
              <label className="admin-check">
                <input name="show_hidden_media" type="checkbox" defaultChecked={filterConfig.show_hidden_media === true} />
                <span>Show hidden items in regular media views</span>
              </label>
              <button type="submit">Save media processing settings</button>
            </form>
          </DisclosureCard>
        </div>
      </section>

      <UploadWidget uploadEnabled={uploadEnabled} missingConfig={storageStatus.missing} />
      <GooglePhotosImportPanel
        importEnabled={googleImportEnabled}
        missingRequired={googleStatus.missingRequired}
        missingOptional={googleStatus.missingOptional}
      />
      <RemoteUrlImportPanel importEnabled={remoteImportEnabled} missingConfig={storageStatus.missing} />

      <section id="albums" className="admin-board-card">
        <div className="admin-board-grid">
          <DisclosureCard
            kicker="Albums"
            title="Create and share album views"
            note="Albums stay attached to items even when those items are hidden."
            badge={`${albums.length} custom albums`}
          >
            <form action={createAlbumAction} className="admin-form-stack admin-album-create-form">
              <input type="hidden" name="returnTo" value="/admin#albums" />
              <div className="admin-grid admin-grid--compact admin-grid--triple">
                <label className="admin-field">
                  <span>Album name</span>
                  <input name="name" placeholder="Studio cuts" required />
                </label>
                <label className="admin-field">
                  <span>Slug</span>
                  <input name="slug" placeholder="studio-cuts" />
                </label>
                <label className="admin-field">
                  <span>Description</span>
                  <input name="description" placeholder="Optional note for admins" />
                </label>
              </div>
              <div className="admin-media-actions">
                <button type="submit">Create album</button>
                <a className="admin-ghost-button" href="/admin/media">Open full library</a>
              </div>
            </form>

            <div className="admin-album-grid">
              {albumCards.map((entry) => (
                <article key={entry.slug} className="admin-album-card">
                  <div>
                    <strong>{entry.name}</strong>
                    <small>{formatNumber(entry.assetCount)} items</small>
                  </div>
                  <p>{entry.description || "Album view for the media library."}</p>
                  <code>{entry.shareUrl}</code>
                  <div className="admin-album-card__actions">
                    <a className="admin-ghost-button" href={entry.href}>Open</a>
                    <a className="admin-ghost-button" href={entry.shareUrl}>Copy link target</a>
                  </div>
                </article>
              ))}
            </div>
          </DisclosureCard>

          <DisclosureCard
            id="visibility"
            kicker="Visibility"
            title="See what is hidden or excluded"
            note="Hidden items remain stored. Use the media library for per-item visibility changes and quick restores."
            badge={`${summary.hiddenCount} hidden`}
          >
            <div className="admin-top-grid">
              <article className="admin-top-card">
                <strong>{formatNumber(summary.hiddenCount)}</strong>
                <span>Hidden items</span>
                <small>Still available inside Hidden and album views.</small>
              </article>
              <article className="admin-top-card">
                <strong>{formatNumber(summary.activeCount)}</strong>
                <span>Active items</span>
                <small>Ready to appear in the library and homepage selection rules.</small>
              </article>
            </div>

            <div className="admin-mini-list">
              {hiddenItems.length ? (
                hiddenItems.map((item) => (
                  <article key={item.id} className="admin-mini-note">
                    <strong>{item.title}</strong>
                    <span>Hidden {formatDateLabel(item.hiddenAt || item.updatedAt || item.createdAt)}</span>
                  </article>
                ))
              ) : (
                <p className="admin-note">No hidden items right now.</p>
              )}
            </div>

            <div className="admin-media-actions">
              <a className="admin-ghost-button" href="/admin/media?view=hidden">Open Hidden items</a>
            </div>
          </DisclosureCard>
        </div>
      </section>

      <section className="admin-board-card">
        <div className="admin-board-grid">
          <DisclosureCard
            id="overrides"
            kicker="Overrides"
            title="Recent manual decisions"
            note="Manual status and notes remain visible so the homepage and library stay understandable to non-technical admins."
            badge={`${overriddenItems.length} recent`}
          >
            <div className="admin-mini-list">
              {overriddenItems.length ? (
                overriddenItems.map((item) => (
                  <article key={item.id} className="admin-mini-note">
                    <strong>{item.title}</strong>
                    <span>{item.overrideStatus || "Notes only"} · {item.overrideBy || "Manual update"} · {formatDateLabel(item.updatedAt || item.createdAt)}</span>
                  </article>
                ))
              ) : (
                <p className="admin-note">No recent overrides were found.</p>
              )}
            </div>

            <div className="admin-media-actions">
              <a className="admin-ghost-button" href="/admin/media">Review item details</a>
            </div>
          </DisclosureCard>

          <DisclosureCard
            id="diagnostics"
            kicker="Diagnostics"
            title="Storage, database, and service health"
            note="These checks keep the admin side readable without exposing implementation jargon in the primary workflow."
            badge={storageStatus.ready ? "Ready" : "Needs setup"}
          >
            <div className="admin-top-grid">
              <article className="admin-top-card">
                <strong>Database</strong>
                <span>{storageStatus.ready ? "Connected" : "Configuration missing"}</span>
                <small>{storageStatus.ready ? "Media records can be created and updated." : (storageStatus.missing.join(", ") || "Check environment settings.")}</small>
              </article>
              <article className="admin-top-card">
                <strong>Storage</strong>
                <span>{storageStatus.ready ? "Ready for uploads" : "Unavailable"}</span>
                <small>Thumbnail caching and media uploads depend on storage being available.</small>
              </article>
              <article className="admin-top-card">
                <strong>Google Photos</strong>
                <span>{googleStatus.ready ? "Ready" : "Needs setup"}</span>
                <small>{googleStatus.ready ? "Picker-based imports are available." : (googleStatus.missingRequired.join(", ") || "Required picker settings are missing.")}</small>
              </article>
              <article className="admin-top-card">
                <strong>Media Processing</strong>
                <span>{filterConfig.enabled ? "Enabled" : "Disabled"}</span>
                <small>{filterConfig.strict_mode ? "Strict visibility rules are on." : "Metadata tagging only."}</small>
              </article>
            </div>
          </DisclosureCard>
        </div>
      </section>

      <section id="settings" className="admin-board-card">
        <div className="admin-board-grid">
          <DisclosureCard
            kicker="Settings"
            title="Operator notes"
            note="Use the sidebar to jump between dashboard, media library, and live control while keeping the public site design unchanged."
            badge="Admin only"
          >
            <div className="admin-mini-list">
              <article className="admin-mini-note">
                <strong>Media Library</strong>
                <span>Open `/admin/media` for high-volume browsing, thumbnails, and per-item edits.</span>
              </article>
              <article className="admin-mini-note">
                <strong>Homepage Features</strong>
                <span>Starred videos control the homepage video pool automatically.</span>
              </article>
              <article className="admin-mini-note">
                <strong>Live Control</strong>
                <span>Use the dedicated live page for stream state without touching media settings.</span>
              </article>
            </div>
          </DisclosureCard>
        </div>
      </section>
    </div>
  );
}
