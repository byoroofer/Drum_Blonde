import GooglePhotosImportPanel from "@/app/admin/google-photos-import-panel";
import RemoteUrlImportPanel from "@/app/admin/remote-url-import-panel";
import TileActionForm from "@/app/admin/tile-action-form";
import {
  createAlbumAction,
  deleteMediaAction,
  logoutAction,
  toggleFeaturedHomeAction,
  toggleHiddenAction,
  updateFilterConfigAction,
  updateMediaAction
} from "@/app/admin/actions";
import UploadWidget from "@/app/admin/upload-widget";
import TrackableVideo from "@/app/components/trackable-video";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getGooglePhotosSetupStatus,
  getStorageSetupStatus
} from "@/lib/env";
import {
  getAdminAlbums,
  getAdminMedia,
  getDashboardSummary,
  getHomepageMedia,
  getMediaEngineConfig
} from "@/lib/media-repo";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const LIBRARY_VIEWS = new Set(["feed", "photos", "videos", "hidden"]);
const LIBRARY_TILE_SIZES = new Set(["large", "medium", "small", "list", "details"]);
const LIBRARY_SORTS = new Set([
  "date_desc",
  "date_asc",
  "name_asc",
  "name_desc",
  "length_desc",
  "length_asc",
  "size_desc",
  "size_asc",
  "type_asc",
  "type_desc"
]);

function SummaryCard({ label, value, tone = "default" }) {
  return (
    <article className={`admin-summary-card admin-summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EnvCodeList({ values }) {
  return values.map((value, index) => (
    <span key={value}>
      {index > 0 ? ", " : null}
      <code>{value}</code>
    </span>
  ));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatDateLabel(value) {
  if (!value) {
    return "Just added";
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

function formatDurationLabel(value) {
  if (value == null) {
    return "Unknown length";
  }

  const seconds = Math.max(0, Math.round(Number(value)));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  const decimals = index === 0 ? 0 : size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[index]}`;
}

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    item.title,
    item.description,
    item.tags,
    item.kind,
    item.source,
    item.originalFilename,
    item.mimeType,
    item.filterReason,
    item.overrideStatus,
    item.overrideNotes,
    ...(item.albumNames || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesStatus(item, status) {
  if (status === "all") {
    return true;
  }

  if (status === "flagged") {
    return item.isFlagged === true;
  }

  if (status === "filtered") {
    return item.isFiltered === true;
  }

  return item.moderationStatus === status;
}

function matchesAlbum(item, albumSlug) {
  if (!albumSlug || albumSlug === "all") {
    return true;
  }

  return (item.albumSlugs || []).includes(albumSlug);
}

function matchesView(item, view, showHiddenMedia) {
  if (view === "hidden") {
    return item.isHidden === true;
  }

  if (!showHiddenMedia && item.isHidden === true) {
    return false;
  }

  if (view === "photos") {
    return item.kind === "image";
  }

  if (view === "videos") {
    return item.kind === "video";
  }

  return true;
}

function buildAssetHref(item) {
  return item.playbackUrl || item.publicUrl || item.url || "#";
}

function buildAdminHref(baseParams, overrides = {}) {
  const params = new URLSearchParams();
  const merged = {
    q: baseParams.q || "",
    view: baseParams.view || "feed",
    status: baseParams.status || "all",
    sort: baseParams.sort || "date_desc",
    album: baseParams.album || "all",
    edit: baseParams.edit || "",
    save: baseParams.save || "",
    media: baseParams.media || "",
    reason: baseParams.reason || "",
    ...overrides
  };

  if (merged.q) params.set("q", merged.q);
  if (merged.view && merged.view !== "feed") params.set("view", merged.view);
  if (merged.status && merged.status !== "all") params.set("status", merged.status);
  if (merged.sort && merged.sort !== "date_desc") params.set("sort", merged.sort);
  if (merged.album && merged.album !== "all") params.set("album", merged.album);
  if (merged.edit) params.set("edit", merged.edit);
  if (merged.save) params.set("save", merged.save);
  if (merged.media) params.set("media", merged.media);
  if (merged.reason) params.set("reason", merged.reason);

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function buildLibraryCounts(items, showHiddenMedia, albumSlug) {
  const albumItems = items.filter((item) => matchesAlbum(item, albumSlug));
  return {
    feed: albumItems.filter((item) => matchesView(item, "feed", showHiddenMedia)).length,
    photos: albumItems.filter((item) => matchesView(item, "photos", showHiddenMedia)).length,
    videos: albumItems.filter((item) => matchesView(item, "videos", showHiddenMedia)).length,
    hidden: albumItems.filter((item) => item.isHidden === true).length
  };
}

function getHiddenToggleReturnTo({ item, baseParams, showHiddenMedia }) {
  if (item.isHidden === true && baseParams.view === "hidden" && !showHiddenMedia) {
    return buildAdminHref(baseParams, { view: "feed", edit: null, save: null, media: null, reason: null });
  }

  if (item.isHidden !== true && baseParams.view !== "hidden" && !showHiddenMedia) {
    return buildAdminHref(baseParams, { view: "hidden", edit: item.id, save: null, media: null, reason: null });
  }

  return buildAdminHref(baseParams, { edit: item.id, save: null, media: null, reason: null });
}

function compareNullableNumbers(left, right, direction = "desc") {
  const leftValue = left == null ? -1 : Number(left);
  const rightValue = right == null ? -1 : Number(right);
  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

function sortLibraryItems(items, sort) {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sort) {
      case "date_asc":
        return compareNullableNumbers(new Date(left.createdAt || 0).getTime(), new Date(right.createdAt || 0).getTime(), "asc");
      case "date_desc":
        return compareNullableNumbers(new Date(left.createdAt || 0).getTime(), new Date(right.createdAt || 0).getTime(), "desc");
      case "name_asc":
        return String(left.title || "").localeCompare(String(right.title || ""), "en", { sensitivity: "base" });
      case "name_desc":
        return String(right.title || "").localeCompare(String(left.title || ""), "en", { sensitivity: "base" });
      case "length_asc":
        return compareNullableNumbers(left.durationSeconds, right.durationSeconds, "asc");
      case "length_desc":
        return compareNullableNumbers(left.durationSeconds, right.durationSeconds, "desc");
      case "size_asc":
        return compareNullableNumbers(left.byteSize, right.byteSize, "asc");
      case "size_desc":
        return compareNullableNumbers(left.byteSize, right.byteSize, "desc");
      case "type_asc":
        return `${left.kind}:${left.mimeType || ""}`.localeCompare(`${right.kind}:${right.mimeType || ""}`, "en", { sensitivity: "base" });
      case "type_desc":
        return `${right.kind}:${right.mimeType || ""}`.localeCompare(`${left.kind}:${left.mimeType || ""}`, "en", { sensitivity: "base" });
      default:
        return 0;
    }
  });

  return sorted;
}

function getSortLabel(sort) {
  switch (sort) {
    case "date_asc":
      return "Oldest first";
    case "name_asc":
      return "Name A-Z";
    case "name_desc":
      return "Name Z-A";
    case "length_desc":
      return "Longest first";
    case "length_asc":
      return "Shortest first";
    case "size_desc":
      return "Largest first";
    case "size_asc":
      return "Smallest first";
    case "type_asc":
      return "Type A-Z";
    case "type_desc":
      return "Type Z-A";
    default:
      return "Newest first";
  }
}

function renderLibraryPreview(item) {
  const poster = item.posterUrl || item.thumbnailUrl || "/images/brooke-tiktok-avatar.jpg";

  if (item.kind === "video" && item.playbackUrl) {
    return (
      <TrackableVideo
        className="admin-library-tile__media"
        src={item.url}
        playbackUrl={item.playbackUrl}
        poster={poster}
        title={item.title}
        controls={false}
        showPlayButton={false}
      />
    );
  }

  return <img className="admin-library-tile__media" src={poster} alt={item.title} loading="lazy" decoding="async" />;
}

function DisclosureCard({ kicker, title, note, badge, defaultOpen = true, children, className = "" }) {
  return (
    <details className={`admin-collapsible admin-collapsible--card ${className}`.trim()} open={defaultOpen}>
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
  const query = String(params.q || "").trim().toLowerCase();
  const status = String(params.status || "all").toLowerCase();
  const sort = LIBRARY_SORTS.has(String(params.sort || "date_desc").toLowerCase()) ? String(params.sort || "date_desc").toLowerCase() : "date_desc";
  const editId = String(params.edit || "").trim();
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

  const requestedView = String(params.view || "feed").toLowerCase();
  const view = LIBRARY_VIEWS.has(requestedView) ? requestedView : "feed";
  const requestedTileSize = String(params.tileSize || "medium").toLowerCase();
  const tileSize = LIBRARY_TILE_SIZES.has(requestedTileSize) ? requestedTileSize : "medium";
  const requestedAlbum = String(params.album || "all").trim().toLowerCase();
  const album = requestedAlbum === "all" || albums.some((entry) => entry.slug === requestedAlbum) ? requestedAlbum : "all";

  const liveRotation = [
    homepageMedia.home.heroVideo,
    homepageMedia.home.secondaryVideo,
    homepageMedia.home.tertiaryVideo,
    ...(homepageMedia.home.backgroundVideos || [])
  ].filter((item, index, array) => item && array.findIndex((candidate) => candidate?.id === item.id) === index);

  const baseLibraryParams = { q: params.q, view, tileSize, status, sort, album, edit: editId };
  const showHiddenMedia = filterConfig.show_hidden_media === true;
  const libraryCounts = buildLibraryCounts(mediaItems, showHiddenMedia, album);
  const albumItems = mediaItems.filter((item) => matchesAlbum(item, album));
  const viewItems = albumItems.filter((item) => matchesView(item, view, showHiddenMedia));
  const filteredItems = sortLibraryItems(
    viewItems.filter((item) => matchesStatus(item, status) && matchesQuery(item, query)),
    sort
  );
  const selectedItem = filteredItems.find((item) => item.id === editId) || viewItems.find((item) => item.id === editId) || null;
  const selectedAlbum = album === "all" ? null : albums.find((entry) => entry.slug === album) || null;

  const albumCards = [
    {
      id: "all",
      name: "All Media",
      slug: "all",
      description: "Full internal camera roll across every album.",
      assetCount: mediaItems.length,
      href: buildAdminHref(baseLibraryParams, { album: "all", edit: null, save: null, media: null, reason: null }),
      shareUrl: origin ? `${origin}${buildAdminHref(baseLibraryParams, { album: "all", edit: null, save: null, media: null, reason: null })}` : buildAdminHref(baseLibraryParams, { album: "all", edit: null, save: null, media: null, reason: null })
    },
    ...albums.map((entry) => ({
      ...entry,
      href: buildAdminHref(baseLibraryParams, { album: entry.slug, edit: null, save: null, media: null, reason: null }),
      shareUrl: origin ? `${origin}${buildAdminHref(baseLibraryParams, { album: entry.slug, edit: null, save: null, media: null, reason: null })}` : buildAdminHref(baseLibraryParams, { album: entry.slug, edit: null, save: null, media: null, reason: null })
    }))
  ];

  return (
    <main className="admin-shell">
      <section className="admin-header-card">
        <div>
          <p className="admin-kicker">DrumBrooke Internal Media Engine</p>
          <h1>Supabase-backed ingestion, storage, filtering, albums, overrides, and debug visibility for internal media only.</h1>
          <p>
            This system defaults to allow, stores first, logs every step, and keeps all filtering optional and reversible.
            Nothing is silently blocked or auto-deleted.
          </p>
        </div>

        <div className="admin-header-actions">
          <a className="admin-ghost-button" href="/" target="_blank" rel="noreferrer">Open live homepage</a>
          <form action={logoutAction}>
            <button type="submit" className="admin-ghost-button">Sign out</button>
          </form>
        </div>
      </section>

      {saveState ? (
        <section className="admin-alert">
          <strong>
            {saveState === "success" && "Media changes saved."}
            {saveState === "deleted" && "Media deleted."}
            {saveState === "config" && "Library settings updated."}
            {saveState === "album" && "Album created."}
            {saveState === "hidden" && "Asset moved to Hidden."}
            {saveState === "unhidden" && "Asset restored from Hidden."}
            {saveState === "error" && "Media engine action failed."}
          </strong>
          <p>
            {saveState === "error"
              ? saveReason || "The requested operation did not complete."
              : savedMediaId
                ? `Asset ${savedMediaId} was updated in the current view.`
                : "The admin state was updated."}
          </p>
        </section>
      ) : null}

      <section className="admin-summary-grid admin-summary-grid--five-up">
        <SummaryCard label="Stored assets" value={formatNumber(mediaItems.length)} />
        <SummaryCard label="Albums" value={formatNumber(summary.albumCount || albums.length)} tone="accent" />
        <SummaryCard label="Active" value={formatNumber(summary.activeCount)} tone="accent" />
        <SummaryCard label="Approved" value={formatNumber(summary.approvedCount)} />
        <SummaryCard label="Review" value={formatNumber(summary.reviewCount)} />
        <SummaryCard label="Rejected" value={formatNumber(summary.rejectedCount)} />
        <SummaryCard label="Flagged" value={formatNumber(summary.flaggedCount)} tone="accent" />
        <SummaryCard label="Filtered tags" value={formatNumber(summary.filteredCount)} />
        <SummaryCard label="Hidden" value={formatNumber(summary.hiddenCount)} />
        <SummaryCard label="Views" value={formatNumber(summary.totalViews)} />
        <SummaryCard label="Plays" value={formatNumber(summary.totalPlays)} />
        <SummaryCard label="Clicks" value={formatNumber(summary.totalClicks)} />
      </section>

      <section className="admin-board-card">
        <div className="admin-board-grid">
          <DisclosureCard
            kicker="Live Homepage Rotation"
            title="Current stack exposed to the homepage"
            note="Featured items still sort ahead, then slot, then smart score. Hidden assets are excluded without changing any other homepage curation semantics."
            badge="curation stays explicit"
          >
            <div className="admin-featured-list">
              {liveRotation.length ? (
                liveRotation.map((item, index) => (
                  <div key={item.id} className="admin-featured-item">
                    <div>
                      <strong>{index + 1}</strong>
                      <span>{item.homeSlot || "Auto"}</span>
                    </div>
                    <div>
                      <p>{item.title}</p>
                      <small>{item.kind} Â· {item.source}</small>
                    </div>
                    <div>
                      <strong>{item.smartScore}</strong>
                      <span>score</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="admin-note">No eligible items are currently available for homepage rotation.</p>
              )}
            </div>
          </DisclosureCard>

          <DisclosureCard
            kicker="Filter Control Panel"
            title="Toggle detection modules at runtime"
            note="Filtering stays metadata-only. This also controls whether hidden assets stay visible in the main feed views."
            badge="default allow"
          >
            <form action={updateFilterConfigAction} className="admin-form-stack">
              <input type="hidden" name="returnTo" value={buildAdminHref(baseLibraryParams, { save: null, media: null, reason: null })} />
              <label className="admin-check">
                <input name="enabled" type="checkbox" defaultChecked={filterConfig.enabled} />
                <span>Enable filtering engine</span>
              </label>
              <label className="admin-check">
                <input name="nsfw_detection" type="checkbox" defaultChecked={filterConfig.nsfw_detection} />
                <span>NSFW detection tagger</span>
              </label>
              <label className="admin-check">
                <input name="face_detection" type="checkbox" defaultChecked={filterConfig.face_detection} />
                <span>Face detection tagger</span>
              </label>
              <label className="admin-check">
                <input name="object_detection" type="checkbox" defaultChecked={filterConfig.object_detection} />
                <span>Object detection tagger</span>
              </label>
              <label className="admin-check">
                <input name="strict_mode" type="checkbox" defaultChecked={filterConfig.strict_mode} />
                <span>Strict mode metadata flag</span>
              </label>
              <label className="admin-check">
                <input name="show_hidden_media" type="checkbox" defaultChecked={showHiddenMedia} />
                <span>Show hidden assets in feed, photos, and videos</span>
              </label>
              <p className="admin-note">
                Filters only annotate metadata. They never prevent storage and never delete files. Hidden assets stay stored,
                reversible, and still keep their album memberships while living in the Hidden folder.
              </p>
              <button type="submit">Save filter config</button>
            </form>
          </DisclosureCard>
        </div>
      </section>

      {!uploadEnabled ? (
        <section className="admin-alert">
          <strong>Supabase setup is still incomplete.</strong>
          <p>Missing <EnvCodeList values={storageStatus.missing} />.</p>
        </section>
      ) : null}

      <UploadWidget uploadEnabled={uploadEnabled} missingConfig={storageStatus.missing} />
      <GooglePhotosImportPanel
        importEnabled={googleImportEnabled}
        missingRequired={googleStatus.missingRequired}
        missingOptional={googleStatus.missingOptional}
      />
      <RemoteUrlImportPanel importEnabled={remoteImportEnabled} missingConfig={storageStatus.missing} />

      <section className="admin-list-card admin-library-card">
        <details className="admin-collapsible admin-collapsible--embedded" open>
          <summary>
            <div className="admin-collapsible__summary">
              <div>
                <p className="admin-kicker">Media Library</p>
                <h2>Internal camera roll, albums, and hidden folder</h2>
                <p>Collapse the whole library when you are working elsewhere, then reopen it on the exact album, view, and sort state you need.</p>
              </div>
              <span className="admin-collapsible__meta">Toggle</span>
            </div>
          </summary>

          <div className="admin-collapsible__body">
            <details className="admin-collapsible admin-collapsible--soft" open>
              <summary>
                <div className="admin-collapsible__summary admin-collapsible__summary--compact">
                  <div>
                    <p className="admin-kicker">Albums</p>
                    <h2>Make additional albums and share direct links</h2>
                  </div>
                  <span className="admin-collapsible__meta">Toggle</span>
                </div>
              </summary>

              <div className="admin-collapsible__body">
                <form action={createAlbumAction} className="admin-form-stack admin-album-create-form">
                  <input type="hidden" name="returnTo" value={buildAdminHref(baseLibraryParams, { save: null, media: null, reason: null, edit: null })} />
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
                      <input name="description" placeholder="Optional internal album note" />
                    </label>
                  </div>
                  <div className="admin-media-actions">
                    <button type="submit">Create album</button>
                    <small>Album links are shareable internal admin URLs. Hiding an asset adds it to Hidden without removing its album memberships.</small>
                  </div>
                </form>

                <div className="admin-album-grid">
                  {albumCards.map((entry) => (
                    <article key={entry.slug} className={`admin-album-card${album === entry.slug ? " admin-album-card--active" : ""}`}>
                      <div>
                        <strong>{entry.name}</strong>
                        <small>{formatNumber(entry.assetCount)} assets</small>
                      </div>
                      <p>{entry.description || (entry.slug === "all" ? "Every asset in the internal library." : "Custom internal album.")}</p>
                      <code>{entry.shareUrl}</code>
                      <div className="admin-album-card__actions">
                        <a className="admin-ghost-button" href={entry.href}>{album === entry.slug ? "Selected" : "Open album"}</a>
                        <a className="admin-ghost-button" href={entry.shareUrl}>Share link</a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </details>

            <div className="admin-list-header admin-library-header">
              <div>
                <h2>{selectedAlbum ? `${selectedAlbum.name} album` : "All media"}</h2>
                <p>
                  {selectedAlbum
                    ? `${selectedAlbum.description || "Filtered to this album."} Hidden assets stay attached to this album even after moving into Hidden.`
                    : "Feed, photo, and video views share one Supabase-backed library. Sort by metadata, assign albums, inspect logs, and override any tagged result manually."}
                </p>
              </div>
              <form className="admin-filter-bar admin-library-controls" method="GET">
                <input name="q" defaultValue={String(params.q || "")} placeholder="Search title, tags, filename, filter reason, overrides, albums" />
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="album" value={album} />
                <select name="status" defaultValue={status}>
                  <option value="all">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="review">Review</option>
                  <option value="rejected">Rejected</option>
                  <option value="flagged">Flagged</option>
                  <option value="filtered">Filtered</option>
                </select>
                <select name="sort" defaultValue={sort}>
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                  <option value="length_desc">Longest first</option>
                  <option value="length_asc">Shortest first</option>
                  <option value="size_desc">Largest first</option>
                  <option value="size_asc">Smallest first</option>
                  <option value="type_asc">Type A-Z</option>
                  <option value="type_desc">Type Z-A</option>
                </select>
                <button type="submit" className="admin-ghost-button">Apply</button>
              </form>
            </div>

            <div className="admin-library-tabs-row">
              <div className="admin-library-tabs" role="tablist" aria-label="Media library view">
                <a className={`admin-library-tab${view === "feed" ? " admin-library-tab--active" : ""}`} href={buildAdminHref(baseLibraryParams, { view: "feed", edit: null, save: null, media: null, reason: null })}>Feed <span>{formatNumber(libraryCounts.feed)}</span></a>
                <a className={`admin-library-tab${view === "photos" ? " admin-library-tab--active" : ""}`} href={buildAdminHref(baseLibraryParams, { view: "photos", edit: null, save: null, media: null, reason: null })}>Photos <span>{formatNumber(libraryCounts.photos)}</span></a>
                <a className={`admin-library-tab${view === "videos" ? " admin-library-tab--active" : ""}`} href={buildAdminHref(baseLibraryParams, { view: "videos", edit: null, save: null, media: null, reason: null })}>Videos <span>{formatNumber(libraryCounts.videos)}</span></a>
                <a className={`admin-library-tab${view === "hidden" ? " admin-library-tab--active" : ""}`} href={buildAdminHref(baseLibraryParams, { view: "hidden", edit: null, save: null, media: null, reason: null })}>Hidden <span>{formatNumber(libraryCounts.hidden)}</span></a>
              </div>
              <div className="admin-tile-size-picker" role="group" aria-label="Tile size">
                {[
                  { key: "large", label: "▦ Large" },
                  { key: "medium", label: "⊞ Medium" },
                  { key: "small", label: "⊟ Small" },
                  { key: "list", label: "≡ List" },
                  { key: "details", label: "☰ Details" }
                ].map(({ key, label }) => (
                  <a key={key} className={`admin-tile-size-btn${tileSize === key ? " admin-tile-size-btn--active" : ""}`} href={buildAdminHref(baseLibraryParams, { tileSize: key, edit: null, save: null, media: null, reason: null })}>{label}</a>
                ))}
              </div>
            </div>

            <div className="admin-library-meta">
              <span>Showing {formatNumber(filteredItems.length)} of {formatNumber(viewItems.length)} assets in this view</span>
              <small>
                {getSortLabel(sort)} | {selectedAlbum
                  ? `Album share link: ${origin}${buildAdminHref(baseLibraryParams, { edit: null, save: null, media: null, reason: null })}`
                  : "Storage-first ingest with verbose logs, reversible filtering, and expandable album folders."}
              </small>
            </div>

            <div className="admin-library-grid" data-tile-size={tileSize}>
              {filteredItems.length ? (
                filteredItems.map((item) => {
                  const tileHref = buildAdminHref(baseLibraryParams, { edit: item.id, save: null, media: null, reason: null });
                  const deleteReturnTo = buildAdminHref(baseLibraryParams, {
                    edit: selectedItem?.id === item.id ? null : selectedItem?.id || null,
                    save: null,
                    media: null,
                    reason: null
                  });
                  const hiddenReturnTo = getHiddenToggleReturnTo({ item, baseParams: baseLibraryParams, showHiddenMedia });

                  const featuredReturnTo = buildAdminHref(baseLibraryParams, { edit: selectedItem?.id || null, save: null, media: null, reason: null });

                  return (
                    <article key={item.id} id={`tile-${item.id}`} className={`admin-library-tile${selectedItem?.id === item.id ? " admin-library-tile--active" : ""}${item.featuredHome ? " admin-library-tile--featured" : ""}`}>
                      <a href={`${tileHref}#tile-${item.id}`} className="admin-library-tile__preview">
                        {renderLibraryPreview(item)}
                        <div className="admin-library-tile__overlay" />
                        <div className="admin-library-tile__badges">
                          <span>{item.kind}</span>
                          <span>{formatDurationLabel(item.durationSeconds)}</span>
                          {item.featuredHome ? <span className="admin-library-badge--featured">★ home</span> : null}
                          {item.isFlagged ? <span>flagged</span> : null}
                          {item.albumNames?.[0] ? <span>{item.albumNames[0]}</span> : null}
                          {item.isHidden ? <span className="admin-library-badge--hidden">hidden</span> : null}
                        </div>
                      </a>
                      <div className="admin-library-tile__body">
                        <div>
                          <strong>{item.title}</strong>
                          <small>{formatDateLabel(item.updatedAt || item.createdAt)} · {formatFileSize(item.byteSize)} · {(item.albumNames || []).length || 0} albums</small>
                        </div>
                        <div className="admin-library-tile__actions">
                          <TileActionForm action={toggleFeaturedHomeAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="featuredHome" value={item.featuredHome ? "false" : "true"} />
                            <button type="submit" className={`admin-ghost-button${item.featuredHome ? " admin-ghost-button--on" : ""}`} title={item.featuredHome ? "Remove from homepage" : "Feature on homepage"}>
                              {item.featuredHome ? "★ Featured" : "☆ Feature"}
                            </button>
                          </TileActionForm>
                          <a className="admin-ghost-button" href={`${tileHref}#tile-${item.id}`}>Edit</a>
                          <TileActionForm action={toggleHiddenAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="isHidden" value={item.isHidden ? "false" : "true"} />
                            <button type="submit" className="admin-ghost-button">{item.isHidden ? "Unhide" : "Hide"}</button>
                          </TileActionForm>
                          <TileActionForm action={deleteMediaAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="admin-delete-button">Delete</button>
                          </TileActionForm>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="admin-note">No assets matched this album view.</p>
              )}
            </div>

            {selectedItem ? (
              <details className="admin-collapsible admin-collapsible--soft" open>
                <summary>
                  <div className="admin-collapsible__summary admin-collapsible__summary--compact">
                    <div>
                      <p className="admin-kicker">Selected Asset</p>
                      <h2>{selectedItem.title}</h2>
                    </div>
                    <span className="admin-collapsible__meta">Toggle</span>
                  </div>
                </summary>

                <div className="admin-collapsible__body">
                  <div className="admin-library-editor">
                    <div className="admin-media-actions admin-media-actions--between">
                      <a className="admin-ghost-button" href={buildAdminHref(baseLibraryParams, { edit: null, save: null, media: null, reason: null })}>Close editor</a>
                      <a className="admin-ghost-button" href={buildAssetHref(selectedItem)} target="_blank" rel="noreferrer">Open asset</a>
                    </div>

                    <div className="admin-library-editor__grid">
                      <div className="admin-library-editor__preview">
                        {selectedItem.kind === "video" && selectedItem.playbackUrl ? (
                          <TrackableVideo
                            src={selectedItem.url}
                            playbackUrl={selectedItem.playbackUrl}
                            poster={selectedItem.posterUrl || selectedItem.thumbnailUrl}
                            title={selectedItem.title}
                            controls
                          />
                        ) : (
                          <img src={selectedItem.posterUrl || selectedItem.thumbnailUrl || "/images/brooke-tiktok-avatar.jpg"} alt={selectedItem.title} />
                        )}
                        <div className="admin-library-editor__meta">
                          <span>{selectedItem.source}</span>
                          <span>{selectedItem.mimeType}</span>
                          <span>{formatFileSize(selectedItem.byteSize)}</span>
                          <span>{selectedItem.width || "?"}x{selectedItem.height || "?"}</span>
                          <span>{formatDurationLabel(selectedItem.durationSeconds)}</span>
                          {selectedItem.isHidden ? <span>hidden folder</span> : null}
                        </div>
                        <p className="admin-note">
                          Flagged: {selectedItem.isFlagged ? "yes" : "no"} | Filtered: {selectedItem.isFiltered ? "yes" : "no"} | Hidden: {selectedItem.isHidden ? "yes" : "no"}
                          {selectedItem.filterReason ? ` | ${selectedItem.filterReason}` : ""}
                        </p>
                      </div>

                      <form action={updateMediaAction} className="admin-library-editor__form">
                        <input type="hidden" name="id" value={selectedItem.id} />
                        <input type="hidden" name="returnTo" value={buildAdminHref(baseLibraryParams, { edit: selectedItem.id, save: null, media: null, reason: null })} />

                        <div className="admin-grid admin-grid--compact admin-grid--triple">
                          <label className="admin-field">
                            <span>Title</span>
                            <input name="title" defaultValue={selectedItem.title} />
                          </label>
                          <label className="admin-field">
                            <span>Workflow status</span>
                            <select name="workflowStatus" defaultValue={selectedItem.workflowStatus || selectedItem.moderationStatus || "approved"}>
                              <option value="approved">approved</option>
                              <option value="review">review</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </label>
                          <label className="admin-field">
                            <span>Override status</span>
                            <select name="overrideStatus" defaultValue={selectedItem.overrideStatus || ""}>
                              <option value="">none</option>
                              <option value="approved">approved</option>
                              <option value="pending">pending</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </label>
                        </div>

                        <label className="admin-field">
                          <span>Description</span>
                          <textarea name="description" rows={3} defaultValue={selectedItem.description || ""} />
                        </label>

                        <label className="admin-field">
                          <span>Tags</span>
                          <input name="tags" defaultValue={selectedItem.tags || ""} />
                        </label>

                        <div className="admin-grid admin-grid--compact admin-grid--triple">
                          <label className="admin-field">
                            <span>Override by</span>
                            <input name="overrideBy" defaultValue={selectedItem.overrideBy || ""} placeholder="Internal operator name" />
                          </label>
                          <label className="admin-field">
                            <span>Manual rank</span>
                            <input name="manualRank" defaultValue={selectedItem.manualRank || 0} />
                          </label>
                          <label className="admin-field">
                            <span>Home slot</span>
                            <input name="homeSlot" defaultValue={selectedItem.homeSlot || ""} />
                          </label>
                        </div>

                        <label className="admin-field">
                          <span>Override notes</span>
                          <textarea name="overrideNotes" rows={2} defaultValue={selectedItem.overrideNotes || ""} />
                        </label>

                        <div className="admin-field">
                          <span>Albums</span>
                          <div className="admin-album-selector">
                            {albums.length ? (
                              albums.map((entry) => (
                                <label key={entry.slug} className="admin-album-chip">
                                  <input name="albumSlugs" type="checkbox" value={entry.slug} defaultChecked={(selectedItem.albumSlugs || []).includes(entry.slug)} />
                                  <span>{entry.name}</span>
                                </label>
                              ))
                            ) : (
                              <p className="admin-note">Create an album above to start organizing media into custom folders.</p>
                            )}
                          </div>
                        </div>

                        <div className="admin-check-row">
                          <label className="admin-check">
                            <input name="featuredHome" type="checkbox" defaultChecked={selectedItem.featuredHome} />
                            <span>Feature on home</span>
                          </label>
                          <label className="admin-check">
                            <input name="active" type="checkbox" defaultChecked={selectedItem.active !== false} />
                            <span>Active</span>
                          </label>
                          <label className="admin-check">
                            <input name="isHidden" type="checkbox" defaultChecked={selectedItem.isHidden === true} />
                            <span>Hide in primary library views</span>
                          </label>
                        </div>

                        <p className="admin-note">
                          Hiding adds this asset to the Hidden folder without removing it from any album. Unhide restores it to the same album links automatically.
                        </p>

                        <div className="admin-media-actions">
                          <button type="submit">Save metadata</button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="admin-board-grid">
                    <DisclosureCard kicker="Debug Panel" title="Ingestion log" defaultOpen={false}>
                      <pre className="admin-debug-panel">{JSON.stringify(selectedItem.ingestionLog, null, 2)}</pre>
                    </DisclosureCard>
                    <DisclosureCard kicker="Processing" title="Processing and errors" defaultOpen={false}>
                      <pre className="admin-debug-panel">{JSON.stringify({ processing: selectedItem.processingLog, errors: selectedItem.errorLog }, null, 2)}</pre>
                    </DisclosureCard>
                  </div>
                </div>
              </details>
            ) : (
              <section className="admin-library-editor admin-library-editor--empty">
                <p className="admin-note">Choose a tile to inspect metadata, assign albums, override state, and raw logs.</p>
              </section>
            )}
          </div>
        </details>
      </section>
    </main>
  );
}



