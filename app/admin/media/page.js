import TileActionForm from "@/app/admin/tile-action-form";
import ClipRangeEditor from "@/app/admin/clip-range-editor";
import { adjustManualRankSilent, deleteMediaSilent, toggleFeaturedHomeSilent, toggleHiddenSilent, toggleSpotlightSilent, updateMediaAction } from "@/app/admin/actions";
import MediaThumbnail from "@/app/components/media-thumbnail";
import TrackableVideo from "@/app/components/trackable-video";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminAlbums, getAdminMedia, getHomepageMedia, getMediaEngineConfig } from "@/lib/media-repo";

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
  "views_desc",
  "views_asc"
]);
const PAGE_SIZE = 48;
const RANK_STEP_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

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

function formatDurationLabel(value) {
  if (value == null) {
    return "Clip";
  }

  const seconds = Math.max(0, Math.round(Number(value)));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatSignedRank(value) {
  const numeric = Math.max(-10, Math.min(10, Math.round(Number(value) || 0)));
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function formatClipRangeLabel(startSeconds, endSeconds, durationSeconds) {
  if (!Number.isFinite(Number(durationSeconds))) {
    return "Full clip";
  }

  const start = Math.max(0, Math.round(Number(startSeconds) || 0));
  const duration = Math.max(0, Math.round(Number(durationSeconds) || 0));
  const end = Number.isFinite(Number(endSeconds)) ? Math.min(duration, Math.round(Number(endSeconds))) : duration;

  if (start <= 0 && end >= duration) {
    return "Full clip";
  }

  return `${formatDurationLabel(start)} to ${formatDurationLabel(end)}`;
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

  if (status === "featured") {
    return item.featuredHome === true;
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
      case "views_asc":
        return compareNullableNumbers(left.views, right.views, "asc");
      case "views_desc":
        return compareNullableNumbers(left.views, right.views, "desc");
      default:
        return 0;
    }
  });

  return sorted;
}

function buildMediaHref(baseParams, overrides = {}) {
  const params = new URLSearchParams();
  const merged = {
    q: baseParams.q || "",
    view: baseParams.view || "feed",
    status: baseParams.status || "all",
    sort: baseParams.sort || "date_desc",
    album: baseParams.album || "all",
    tileSize: baseParams.tileSize || "medium",
    page: baseParams.page || 1,
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
  if (merged.tileSize && merged.tileSize !== "medium") params.set("tileSize", merged.tileSize);
  if (Number(merged.page) > 1) params.set("page", String(merged.page));
  if (merged.edit) params.set("edit", merged.edit);
  if (merged.save) params.set("save", merged.save);
  if (merged.media) params.set("media", merged.media);
  if (merged.reason) params.set("reason", merged.reason);

  const query = params.toString();
  return query ? `/admin/media?${query}` : "/admin/media";
}

function buildAssetHref(item) {
  return item.playbackUrl || item.publicUrl || item.url || "#";
}

function buildEditorRouteHref(itemId, returnTo) {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  const query = params.toString();
  return query ? `/admin/media/edit/${itemId}?${query}` : `/admin/media/edit/${itemId}`;
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

function getThumbnailSrc(item) {
  return item.adminThumbnailUrl || item.thumbnailUrl || item.posterUrl || "/images/brooke-tiktok-avatar.jpg";
}

export default async function AdminMediaPage({ searchParams }) {
  await requireAdmin();

  const params = (await searchParams) || {};
  const query = String(params.q || "").trim().toLowerCase();
  const status = String(params.status || "all").toLowerCase();
  const sort = LIBRARY_SORTS.has(String(params.sort || "date_desc").toLowerCase()) ? String(params.sort || "date_desc").toLowerCase() : "date_desc";
  const requestedView = String(params.view || "feed").toLowerCase();
  const view = LIBRARY_VIEWS.has(requestedView) ? requestedView : "feed";
  const requestedTileSize = String(params.tileSize || "medium").toLowerCase();
  const tileSize = LIBRARY_TILE_SIZES.has(requestedTileSize) ? requestedTileSize : "medium";
  const editId = String(params.edit || "").trim();
  const saveState = String(params.save || "").toLowerCase();
  const savedMediaId = String(params.media || "").trim();
  const saveReason = String(params.reason || "").trim();

  const [mediaItems, albums, homepageMedia, filterConfig] = await Promise.all([
    getAdminMedia(),
    getAdminAlbums(),
    getHomepageMedia(),
    getMediaEngineConfig()
  ]);

  const requestedAlbum = String(params.album || "all").trim().toLowerCase();
  const album = requestedAlbum === "all" || albums.some((entry) => entry.slug === requestedAlbum) ? requestedAlbum : "all";
  const showHiddenMedia = filterConfig.show_hidden_media === true;
  const libraryCounts = buildLibraryCounts(mediaItems, showHiddenMedia, album);
  const albumItems = mediaItems.filter((item) => matchesAlbum(item, album));
  const viewItems = albumItems.filter((item) => matchesView(item, view, showHiddenMedia));
  const filteredItems = sortLibraryItems(
    viewItems.filter((item) => matchesStatus(item, status) && matchesQuery(item, query)),
    sort
  );

  const selectedIndex = filteredItems.findIndex((item) => item.id === editId);
  const requestedPage = Math.max(1, Number.parseInt(String(params.page || "1"), 10) || 1);
  const effectivePage = selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_SIZE) + 1 : requestedPage;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(effectivePage, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedItem = filteredItems.find((item) => item.id === editId) || null;
  const baseParams = { q: params.q, view, status, sort, album, tileSize, page: currentPage, edit: editId };
  const spotlightLeader = homepageMedia.home.spotlightItem || homepageMedia.home.heroVideo || null;
  const rotationIds = new Set((homepageMedia.home.featuredVideos || []).map((item) => item.id));

  return (
    <div className="admin-shell">
      <section className="admin-header-card">
        <div>
          <p className="admin-kicker">Media Library</p>
          <h1>Browse the full library with thumbnails, filters, starring, albums, and quick edits.</h1>
          <p>
            Video thumbnails now use cached posters when available and can backfill missing previews on demand, so large libraries stay scannable.
          </p>
        </div>

        <div className="admin-header-actions">
          <a className="admin-ghost-button" href="/admin">Back to dashboard</a>
          <a className="admin-ghost-button" href={buildMediaHref(baseParams, { view: "videos", edit: null })}>Featured videos</a>
        </div>
      </section>

      {saveState ? (
        <section className="admin-alert">
          <strong>
            {saveState === "success" && "Media changes saved."}
            {saveState === "deleted" && "Media removed."}
            {saveState === "edited" && "Edited asset saved."}
            {saveState === "featured" && "Item added to homepage features."}
            {saveState === "unfeatured" && "Item removed from homepage features."}
            {saveState === "hidden" && "Item moved to Hidden."}
            {saveState === "unhidden" && "Item restored from Hidden."}
            {saveState === "error" && "Media action failed."}
          </strong>
          <p>
            {saveState === "error"
              ? saveReason || "The requested update did not complete."
              : savedMediaId
                ? `Item ${savedMediaId} was updated.`
                : "The media library was updated."}
          </p>
        </section>
      ) : null}

      <section className="admin-list-card admin-library-card">
        <div className="admin-list-header admin-library-header">
          <div>
            <h2>{album === "all" ? "All media" : `${albums.find((entry) => entry.slug === album)?.name || "Album"} media`}</h2>
            <p>
              Showing {formatNumber(filteredItems.length)} of {formatNumber(viewItems.length)} items in this view. Spotlight and rotation badges reflect the live homepage order.
            </p>
          </div>

          <form className="admin-filter-bar admin-library-controls" method="GET">
            <input name="q" defaultValue={String(params.q || "")} placeholder="Search title, tags, filename, notes, albums" />
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="album" value={album} />
            <input type="hidden" name="tileSize" value={tileSize} />
            <select name="status" defaultValue={status}>
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="review">In review</option>
              <option value="rejected">Rejected</option>
              <option value="flagged">Flagged</option>
              <option value="filtered">Filtered</option>
              <option value="featured">Starred</option>
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
              <option value="views_desc">Most viewed</option>
              <option value="views_asc">Least viewed</option>
            </select>
            <button type="submit" className="admin-ghost-button">Apply</button>
          </form>
        </div>

        <div className="admin-album-strip">
          {[
            { slug: "all", name: "All Media", assetCount: mediaItems.length },
            ...albums
          ].map((entry) => (
            <a
              key={entry.slug}
              className={`admin-album-strip__chip${album === entry.slug ? " admin-album-strip__chip--active" : ""}`}
              href={buildMediaHref(baseParams, { album: entry.slug, page: 1, edit: null })}
            >
              {entry.name}
              <span>{formatNumber(entry.assetCount)}</span>
            </a>
          ))}
        </div>

        <div className="admin-library-tabs-row">
          <div className="admin-library-tabs" role="tablist" aria-label="Media library view">
            <a className={`admin-library-tab${view === "feed" ? " admin-library-tab--active" : ""}`} href={buildMediaHref(baseParams, { view: "feed", page: 1, edit: null })}>Feed <span>{formatNumber(libraryCounts.feed)}</span></a>
            <a className={`admin-library-tab${view === "photos" ? " admin-library-tab--active" : ""}`} href={buildMediaHref(baseParams, { view: "photos", page: 1, edit: null })}>Photos <span>{formatNumber(libraryCounts.photos)}</span></a>
            <a className={`admin-library-tab${view === "videos" ? " admin-library-tab--active" : ""}`} href={buildMediaHref(baseParams, { view: "videos", page: 1, edit: null })}>Videos <span>{formatNumber(libraryCounts.videos)}</span></a>
            <a className={`admin-library-tab${view === "hidden" ? " admin-library-tab--active" : ""}`} href={buildMediaHref(baseParams, { view: "hidden", page: 1, edit: null })}>Hidden <span>{formatNumber(libraryCounts.hidden)}</span></a>
          </div>

          <div className="admin-tile-size-picker" role="group" aria-label="Tile size">
            {[
              { key: "large", label: "Large" },
              { key: "medium", label: "Medium" },
              { key: "small", label: "Small" },
              { key: "list", label: "List" },
              { key: "details", label: "Details" }
            ].map(({ key, label }) => (
              <a key={key} className={`admin-tile-size-btn${tileSize === key ? " admin-tile-size-btn--active" : ""}`} href={buildMediaHref(baseParams, { tileSize: key, page: 1, edit: null })}>{label}</a>
            ))}
          </div>
        </div>

        <div className="admin-library-meta">
          <span>{formatNumber(currentPage)} / {formatNumber(totalPages)} pages · {formatNumber(PAGE_SIZE)} items per page</span>
          <small>
            Hidden items {showHiddenMedia ? "can" : "cannot"} appear in standard feed views. Starred videos join the homepage rotation automatically.
          </small>
        </div>

        <div className="admin-library-grid" data-tile-size={tileSize}>
          {pageItems.length ? (
            pageItems.map((item) => {
              const tileHref = buildMediaHref(baseParams, { edit: item.id, page: currentPage });
              const routeEditorHref = buildEditorRouteHref(item.id, `${tileHref}#tile-${item.id}`);
              const isSpotlight = item.spotlightHome === true;
              const isSpotlightLeader = item.id === spotlightLeader?.id;
              const isInRotation = rotationIds.has(item.id);

              return (
                <article key={item.id} id={`tile-${item.id}`} className={`admin-library-tile${selectedItem?.id === item.id ? " admin-library-tile--active" : ""}${item.featuredHome ? " admin-library-tile--featured" : ""}`}>
                  <div className="admin-library-tile__preview">
                    <a href={`${tileHref}#tile-${item.id}`} className="admin-library-tile__preview-link">
                      <MediaThumbnail
                        className="admin-library-tile__media"
                        kind={item.kind}
                        alt={item.title || ""}
                        storedThumbnailSrc={item.storedThumbnailUrl}
                        fallbackImageSrc={item.placeholderThumbnailUrl || getThumbnailSrc(item)}
                        videoSrc={item.playbackUrl}
                        durationSeconds={item.durationSeconds}
                        thumbnailBackfillUrl={item.thumbnailBackfillUrl}
                        cacheKey={`${item.id || item.url || "media"}-${item.updatedAt || item.createdAt || "0"}`}
                      />
                      <div className="admin-library-tile__overlay" />
                      <div className="admin-library-tile__badges">
                        <span>{item.kind}</span>
                        {item.kind === "video" ? <span>{formatDurationLabel(item.durationSeconds)}</span> : null}
                        {item.kind === "video" ? <span>{formatClipRangeLabel(item.clipStartSeconds, item.clipEndSeconds, item.durationSeconds)}</span> : null}
                        {item.featuredHome ? <span className="admin-library-badge--featured">Starred</span> : null}
                        {isSpotlight ? <span className="admin-library-badge--spotlight">{isSpotlightLeader ? "Spotlight" : "Spotlight pool"}</span> : null}
                        {!isSpotlight && isInRotation ? <span className="admin-library-badge--rotation">Rotation</span> : null}
                        {item.isDerived ? <span className="admin-library-badge--derived">{item.editType || "Derived edit"}</span> : null}
                        {item.isHidden ? <span className="admin-library-badge--hidden">Hidden</span> : null}
                      </div>
                    </a>

                    <TileActionForm action={toggleFeaturedHomeSilent} className="admin-library-tile__star-form">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="featuredHome" value={item.featuredHome ? "false" : "true"} />
                      <button type="submit" className={`admin-library-tile__star${item.featuredHome ? " admin-library-tile__star--on" : ""}`} title={item.featuredHome ? "Remove star" : "Star for homepage"}>
                        {item.featuredHome ? "★" : "☆"}
                      </button>
                    </TileActionForm>
                    <TileActionForm action={toggleSpotlightSilent} className="admin-library-tile__spotlight-form">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="spotlightHome" value={isSpotlight ? "false" : "true"} />
                      <button type="submit" className={`admin-library-tile__spotlight${isSpotlight ? " admin-library-tile__spotlight--on" : ""}`} title={isSpotlight ? "Remove from homepage spotlight pool" : "Add to homepage spotlight pool"}>
                        ◉
                      </button>
                    </TileActionForm>
                  </div>

                  <div className="admin-library-tile__body">
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {formatDateLabel(item.updatedAt || item.createdAt)} · {formatFileSize(item.byteSize)} · {formatNumber(item.views)} views · {(item.albumNames || []).length} albums
                      </small>
                    </div>

                    <div className="admin-library-tile__metadata">
                      <span>{item.source}</span>
                      <span>{item.mimeType}</span>
                      {item.albumNames?.[0] ? <span>{item.albumNames[0]}</span> : null}
                      {item.derivedFromAssetId ? <span>From {item.derivedFromTitle || item.derivedFromAssetId.slice(0, 8)}</span> : null}
                    </div>

                    {item.kind === "video" ? (
                      <div className="admin-library-rank-box">
                        <div className="admin-library-rank-box__header">
                          <span>Rank</span>
                          <strong>{formatSignedRank(item.manualRank)}</strong>
                        </div>
                        <TileActionForm action={adjustManualRankSilent} className="admin-library-rank-box__controls">
                          <input type="hidden" name="id" value={item.id} />
                          <label className="admin-library-rank-box__step">
                            <span>Step</span>
                            <select name="rankStep" defaultValue="1" aria-label={`Rank step for ${item.title || "video"}`}>
                              {RANK_STEP_OPTIONS.map((value) => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" name="rankDirection" value="down" className="admin-library-rank-box__button" title="Lower rotation rank">
                            ↓
                          </button>
                          <button type="submit" name="rankDirection" value="up" className="admin-library-rank-box__button" title="Raise rotation rank">
                            ↑
                          </button>
                        </TileActionForm>
                      </div>
                    ) : null}

                    <div className="admin-library-tile__actions">
                      <a className="admin-ghost-button" href={routeEditorHref}>Edit</a>
                      <TileActionForm action={toggleHiddenSilent} style={{ display: "contents" }}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="isHidden" value={item.isHidden ? "false" : "true"} />
                        <button type="submit" className="admin-ghost-button">{item.isHidden ? "Unhide" : "Hide"}</button>
                      </TileActionForm>
                      <TileActionForm action={deleteMediaSilent} style={{ display: "contents" }}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="admin-delete-button">Delete</button>
                      </TileActionForm>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="admin-note">No items matched this view.</p>
          )}
        </div>

        <div className="admin-pagination">
          <a className={`admin-ghost-button${currentPage <= 1 ? " admin-ghost-button--disabled" : ""}`} href={currentPage <= 1 ? buildMediaHref(baseParams) : buildMediaHref(baseParams, { page: currentPage - 1, edit: null })}>Previous</a>
          <span>Page {formatNumber(currentPage)} of {formatNumber(totalPages)}</span>
          <a className={`admin-ghost-button${currentPage >= totalPages ? " admin-ghost-button--disabled" : ""}`} href={currentPage >= totalPages ? buildMediaHref(baseParams) : buildMediaHref(baseParams, { page: currentPage + 1, edit: null })}>Next</a>
        </div>
      </section>

      {selectedItem ? (
        <section className="admin-list-card">
          <div className="admin-list-header">
            <div>
              <p className="admin-kicker">Item Details</p>
              <h2>{selectedItem.title}</h2>
              <p>Star state, spotlight status, albums, visibility, and metadata stay together here.</p>
            </div>
            <div className="admin-header-actions">
              <a className="admin-ghost-button" href={buildMediaHref(baseParams, { edit: null })}>Close editor</a>
              <a className="admin-ghost-button" href={buildAssetHref(selectedItem)} target="_blank" rel="noreferrer">Open asset</a>
            </div>
          </div>

          <div className="admin-library-editor__grid">
            <div className="admin-library-editor admin-library-editor__preview">
              {selectedItem.kind === "video" && selectedItem.playbackUrl ? (
                <TrackableVideo
                  src={selectedItem.url}
                  playbackUrl={selectedItem.playbackUrl}
                  poster={getThumbnailSrc(selectedItem)}
                  title={selectedItem.title}
                  clipStartSeconds={selectedItem.clipStartSeconds}
                  clipEndSeconds={selectedItem.clipEndSeconds}
                  controls
                />
              ) : (
                <MediaThumbnail
                  className="admin-library-detail__media"
                  kind={selectedItem.kind}
                  alt={selectedItem.title}
                  storedThumbnailSrc={selectedItem.storedThumbnailUrl || getThumbnailSrc(selectedItem)}
                  fallbackImageSrc={selectedItem.placeholderThumbnailUrl || getThumbnailSrc(selectedItem)}
                  videoSrc={selectedItem.playbackUrl}
                  durationSeconds={selectedItem.durationSeconds}
                  thumbnailBackfillUrl={selectedItem.thumbnailBackfillUrl}
                  cacheKey={`${selectedItem.id || selectedItem.url || "media"}-${selectedItem.updatedAt || selectedItem.createdAt || "0"}-detail`}
                />
              )}

              <div className="admin-library-editor__meta">
                <span>{selectedItem.source}</span>
                <span>{selectedItem.mimeType}</span>
                <span>{formatFileSize(selectedItem.byteSize)}</span>
                <span>{selectedItem.width || "?"}x{selectedItem.height || "?"}</span>
                <span>{formatDurationLabel(selectedItem.durationSeconds)}</span>
                <span>{formatNumber(selectedItem.views)} views</span>
              </div>

              <div className="admin-badge-row">
                {selectedItem.featuredHome ? <span className="admin-pill admin-pill--accent">Starred</span> : null}
                {selectedItem.id === spotlightLeader?.id ? <span className="admin-pill admin-pill--accent">Spotlight leader</span> : null}
                {selectedItem.spotlightHome === true && selectedItem.id !== spotlightLeader?.id ? <span className="admin-pill">In spotlight pool</span> : null}
                {rotationIds.has(selectedItem.id) && selectedItem.id !== spotlightLeader?.id ? <span className="admin-pill">In rotation</span> : null}
                {selectedItem.kind === "video" ? <span className="admin-pill">{formatClipRangeLabel(selectedItem.clipStartSeconds, selectedItem.clipEndSeconds, selectedItem.durationSeconds)}</span> : null}
                {selectedItem.isDerived ? <span className="admin-pill">Derived {selectedItem.editType || "edit"}</span> : null}
                {selectedItem.derivedFromAssetId ? <span className="admin-pill">Original {selectedItem.derivedFromTitle || selectedItem.derivedFromAssetId.slice(0, 8)}</span> : null}
                {selectedItem.latestDerivedAssetId ? <span className="admin-pill">Latest derived saved</span> : null}
                {selectedItem.isHidden ? <span className="admin-pill">Hidden</span> : null}
                {selectedItem.overrideStatus ? <span className="admin-pill">Override: {selectedItem.overrideStatus}</span> : null}
              </div>
            </div>

            <div className="admin-library-editor__side">
              <section className="admin-library-editor admin-library-editor__form">
                <div className="media-asset-editor__header">
                  <div>
                    <p className="admin-kicker">Asset Editor</p>
                    <h3>Open the full-screen editor</h3>
                    <p>Launch the dedicated editor route to save a derived image or video while keeping the original untouched.</p>
                  </div>
                </div>

                <div className="admin-media-actions">
                  <a
                    className="admin-ghost-button"
                    href={buildEditorRouteHref(selectedItem.id, buildMediaHref(baseParams, { edit: selectedItem.id }))}
                  >
                    Open {selectedItem.kind === "video" ? "video" : "photo"} editor
                  </a>
                  <a className="admin-ghost-button" href={buildAssetHref(selectedItem)} target="_blank" rel="noreferrer">
                    Open source asset
                  </a>
                </div>
              </section>

              <form action={updateMediaAction} className="admin-library-editor admin-library-editor__form">
                <input type="hidden" name="id" value={selectedItem.id} />
                <input type="hidden" name="returnTo" value={buildMediaHref(baseParams, { edit: selectedItem.id })} />

                <div className="media-asset-editor__header">
                  <div>
                    <p className="admin-kicker">Metadata</p>
                    <h3>Item details</h3>
                    <p>Star state, spotlight status, albums, visibility, and metadata stay together here.</p>
                  </div>
                </div>

                <div className="admin-grid admin-grid--compact admin-grid--triple">
                  <label className="admin-field">
                    <span>Title</span>
                    <input name="title" defaultValue={selectedItem.title} />
                  </label>
                  <label className="admin-field">
                    <span>Status</span>
                    <select name="workflowStatus" defaultValue={selectedItem.workflowStatus || selectedItem.moderationStatus || "approved"}>
                      <option value="approved">approved</option>
                      <option value="review">review</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </label>
                  <label className="admin-field">
                    <span>Override</span>
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
                    <input name="overrideBy" defaultValue={selectedItem.overrideBy || ""} placeholder="Operator name" />
                  </label>
                  <label className="admin-field">
                    <span>Manual rank</span>
                    <input name="manualRank" type="number" min="-10" max="10" step="1" defaultValue={selectedItem.manualRank || 0} />
                  </label>
                  <label className="admin-field">
                    <span>Home slot</span>
                    <input name="homeSlot" defaultValue={selectedItem.homeSlot || ""} placeholder="Optional" />
                  </label>
                </div>

                <label className="admin-field">
                  <span>Notes</span>
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
                      <p className="admin-note">Create albums from the dashboard to start organizing library views.</p>
                    )}
                  </div>
                </div>

                <div className="admin-check-row">
                  <label className="admin-check">
                    <input name="featuredHome" type="checkbox" defaultChecked={selectedItem.featuredHome} />
                    <span>Star for homepage rotation</span>
                  </label>
                  <label className="admin-check">
                    <input name="spotlightHome" type="checkbox" defaultChecked={selectedItem.spotlightHome === true} />
                    <span>Homepage spotlight</span>
                  </label>
                  <label className="admin-check">
                    <input name="active" type="checkbox" defaultChecked={selectedItem.active !== false} />
                    <span>Active</span>
                  </label>
                  <label className="admin-check">
                    <input name="isHidden" type="checkbox" defaultChecked={selectedItem.isHidden === true} />
                    <span>Hidden</span>
                  </label>
                </div>

                {selectedItem.kind === "video" && selectedItem.durationSeconds ? (
                  <div className="admin-field">
                    <span>Featured clip range</span>
                    <ClipRangeEditor
                      durationSeconds={selectedItem.durationSeconds}
                      defaultStartSeconds={selectedItem.clipStartSeconds}
                      defaultEndSeconds={selectedItem.clipEndSeconds ?? selectedItem.durationSeconds}
                    />
                  </div>
                ) : null}

                <div className="admin-media-actions">
                  <button type="submit">Save item</button>
                </div>
              </form>
            </div>
          </div>

          <div className="admin-board-grid">
            <details className="admin-collapsible admin-collapsible--card">
              <summary>
                <div className="admin-collapsible__summary admin-collapsible__summary--compact">
                  <div>
                    <p className="admin-kicker">Diagnostics</p>
                    <h2>Ingestion log</h2>
                  </div>
                  <span className="admin-collapsible__meta">Toggle</span>
                </div>
              </summary>
              <div className="admin-collapsible__body">
                <pre className="admin-debug-panel">{JSON.stringify(selectedItem.ingestionLog, null, 2)}</pre>
              </div>
            </details>

            <details className="admin-collapsible admin-collapsible--card">
              <summary>
                <div className="admin-collapsible__summary admin-collapsible__summary--compact">
                  <div>
                    <p className="admin-kicker">Diagnostics</p>
                    <h2>Processing and errors</h2>
                  </div>
                  <span className="admin-collapsible__meta">Toggle</span>
                </div>
              </summary>
              <div className="admin-collapsible__body">
                <pre className="admin-debug-panel">{JSON.stringify({ processing: selectedItem.processingLog, errors: selectedItem.errorLog }, null, 2)}</pre>
              </div>
            </details>
          </div>
        </section>
      ) : null}
    </div>
  );
}
