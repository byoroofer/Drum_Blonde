import HomeAnalytics from "@/app/components/home-analytics";
import TrackableLink from "@/app/components/trackable-link";
import TrackableVideo from "@/app/components/trackable-video";
import { getLiveConfig } from "@/data/liveConfig";
import { siteData } from "@/data/siteData";
import { getHomepageMedia } from "@/lib/media-repo";

export const revalidate = 300;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 17 17 7M9 7h8v8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PlatformIcon({ platform }) {
  switch (platform) {
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.9 3.2c.5 1.5 1.4 2.8 2.7 3.7 1 .7 2.1 1.1 3.4 1.2v3.1c-1.7 0-3.4-.5-4.8-1.3v4.4c0 1.8-.5 3.2-1.5 4.4-1.2 1.4-3 2.1-5 2.1-3.5 0-6.3-2.8-6.3-6.3 0-2.6 1.6-5 4-6 .8-.3 1.6-.5 2.4-.5.5 0 .9 0 1.4.1v3.2c-.4-.1-.9-.2-1.4-.2-1.9 0-3.4 1.5-3.4 3.4 0 1.3.8 2.5 2 3 .4.2.9.3 1.4.3 1.9 0 3.3-1.4 3.4-3.2V3.2h3.7Z" fill="#FE2C55" />
          <path d="M13.6 2c.5 1.5 1.4 2.8 2.7 3.7 1 .7 2.1 1.1 3.4 1.2V10c-1.7 0-3.4-.5-4.8-1.3v4.4c0 1.8-.5 3.2-1.5 4.4-1.2 1.4-3 2.1-5 2.1-.7 0-1.3-.1-1.9-.3 1 .9 2.4 1.5 4 1.5 2 0 3.8-.8 5-2.1 1-1.2 1.5-2.6 1.5-4.4V10c1.4.8 3.1 1.3 4.8 1.3V8.1c-1.3-.1-2.4-.5-3.4-1.2-1.3-.9-2.2-2.2-2.7-3.7h-2.1Z" fill="#25F4EE" />
          <path d="M14.2 2.6c.4 1.5 1.3 2.7 2.6 3.6 1 .7 2.1 1.1 3.2 1.2v2.2c-1.5 0-3-.4-4.2-1.1l-.8-.4v5.4c0 1.5-.4 2.8-1.3 3.8-1 1.2-2.6 1.9-4.3 1.9-3 0-5.5-2.5-5.5-5.5 0-2.2 1.3-4.2 3.4-5 .6-.3 1.3-.4 2-.4.4 0 .8 0 1.2.1v2.4c-.4-.1-.7-.2-1.1-.2-1.7 0-3 1.3-3 3 0 1.2.7 2.2 1.7 2.7.4.2.8.2 1.3.2 1.6 0 2.9-1.2 3-2.8V2.6h1.8Z" fill="#FFFFFF" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5.5" fill="#FFFFFF" />
          <path d="M7.8 3h8.4A4.8 4.8 0 0 1 21 7.8v8.4a4.8 4.8 0 0 1-4.8 4.8H7.8A4.8 4.8 0 0 1 3 16.2V7.8A4.8 4.8 0 0 1 7.8 3Zm0 1.8A3 3 0 0 0 4.8 7.8v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm9.3 1.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm-5.1 1.3A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5Zm0 1.8A2.7 2.7 0 1 0 14.7 12 2.7 2.7 0 0 0 12 9.3Z" fill="currentColor" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.4 7.3A3.4 3.4 0 0 0 18 4.9C16.1 4.4 12 4.4 12 4.4s-4.1 0-6 .5A3.4 3.4 0 0 0 3.6 7.3 35.8 35.8 0 0 0 3.4 12c0 1.6.1 3.2.2 4.7A3.4 3.4 0 0 0 6 19.1c1.9.5 6 .5 6 .5s4.1 0 6-.5a3.4 3.4 0 0 0 2.4-2.4c.2-1.5.2-3.1.2-4.7 0-1.6 0-3.2-.2-4.7Z" fill="#FF0033" />
          <path d="m10.1 15.3 5.7-3.3-5.7-3.3v6.6Z" fill="#FFFFFF" />
        </svg>
      );
    case "twitch":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 3h16v10.2l-3.8 3.8h-3l-2.6 2.6H8.2V17H4V3Z" fill="#9146FF" />
          <path d="M7 5.5v9h2.3V17l2.5-2.5H15l2.5-2.5v-6.5H7Zm5.3 1.9h1.8v4.4h-1.8V7.4Zm-3.9 0h1.8v4.4H8.4V7.4Z" fill="#FFFFFF" />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" />
          <path d="m5.7 8.2 6.3 4.4 6.3-4.4" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="m6 16.6 4.2-4m7.8 4-4.2-4" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" opacity=".75" />
        </svg>
      );
    case "shop":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.4 7.2A4.6 4.6 0 0 1 12 3.5a4.6 4.6 0 0 1 4.6 3.7h1a1.7 1.7 0 0 1 1.7 1.8l-.6 9.3A2 2 0 0 1 16.7 20H7.3a2 2 0 0 1-2-1.7L4.7 9A1.7 1.7 0 0 1 6.4 7.2h1Zm1.8 0h5.6A2.8 2.8 0 0 0 12 5.3a2.8 2.8 0 0 0-2.8 1.9ZM6.6 9l.6 8.7c0 .3.1.5.4.5h8.8c.3 0 .4-.2.4-.5l.6-8.7H6.6Z" fill="currentColor" />
        </svg>
      );
    default:
      return <ArrowIcon />;
  }
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function getPlatformClass(prefix, platform) {
  return platform ? `${prefix} ${prefix}--platform ${prefix}--${platform}` : prefix;
}

function PlatformWordmark({ platform, children }) {
  return <span className={getPlatformClass("platform-wordmark", platform)}>{children}</span>;
}

function PlatformBadge({ item, compact = false }) {
  if (!item?.platform) {
    return null;
  }

  return (
    <div className={compact ? "platform-brand platform-brand--compact" : "platform-brand"}>
      <span className={compact ? "platform-brand__icon platform-brand__icon--small" : "platform-brand__icon"}>
        <PlatformIcon platform={item.platform} />
      </span>
      <div className="platform-brand__meta">
        <PlatformWordmark platform={item.platform}>{item.platformLabel || item.label || item.title}</PlatformWordmark>
        {item.handle ? <small>{item.handle}</small> : null}
      </div>
    </div>
  );
}

function SocialCta({ item, secondary = false }) {
  return (
    <TrackableLink
      className={`${getPlatformClass("cta-button", item.platform)}${secondary ? " cta-button--ghost" : ""}`}
      href={item.href}
      eventLabel={item.label}
    >
      <span className="cta-button__icon">
        <PlatformIcon platform={item.platform} />
      </span>
      <PlatformWordmark platform={item.platform}>{item.label}</PlatformWordmark>
    </TrackableLink>
  );
}

function LinkCard({ item }) {
  return (
    <TrackableLink className={getPlatformClass("link-card", item.platform)} href={item.href} eventLabel={item.title}>
      <div className="link-card__main">
        <PlatformBadge item={item} />
        <div className="link-card__copy">
          <p>{item.title}</p>
          <span>{item.description}</span>
        </div>
      </div>
      <div className="link-card__cta">
        <span>{item.platform ? "Open" : "Go"}</span>
        <ArrowIcon />
      </div>
    </TrackableLink>
  );
}

function SocialLinkCard({ item, className }) {
  return (
    <TrackableLink className={className} href={item.href} eventLabel={item.label}>
      <PlatformBadge item={item} compact />
      <span className="platform-link__action">
        Open
        <ArrowIcon />
      </span>
    </TrackableLink>
  );
}

function EmbeddedVideo({ item, className = "video-card__player", autoPlay = false }) {
  if (!item?.embedUrl) {
    return null;
  }

  const title = item.title || "Embedded video";
  const platformClass = item.platform ? ` smart-video--${item.platform}` : "";

  return (
    <div className={className + " smart-video smart-video--embed" + platformClass}>
      <iframe
        src={item.embedUrl}
        title={title}
        loading={autoPlay ? "eager" : "lazy"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

function VideoCard({ item, autoPlay = false, muted = true, className = "video-card", showBody = true }) {
  if (!item) {
    return null;
  }

  return (
    <article className={className}>
      {item.embedUrl ? (
        <EmbeddedVideo item={item} className="video-card__player" autoPlay={autoPlay} />
      ) : (
        <TrackableVideo
          className="video-card__player"
          src={item.url}
          playbackUrl={item.playbackUrl}
          poster={item.posterUrl || item.thumbnailUrl}
          title={item.title}
          mediaId={item.id}
          autoPlay={autoPlay}
          loop={autoPlay}
          muted={muted}
          controls
          eager={autoPlay}
          showPlayButton={!autoPlay}
        />
      )}
      {showBody ? (
        <div className="video-card__body">
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </div>
      ) : null}
    </article>
  );
}

function MerchCard({ item }) {
  return (
    <article className="merch-card">
      <div className="merch-card__art" style={{ background: item.gradient }}>
        <span>{item.badge}</span>
      </div>
      <div className="merch-card__body">
        <div>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
        </div>
        <div className="merch-card__footer">
          <strong>{item.price}</strong>
          <TrackableLink href={item.href} eventLabel={item.name}>
            Shop item
          </TrackableLink>
        </div>
      </div>
    </article>
  );
}

function MinimalFooterLink({ href, children }) {
  return (
    <a
      href={href}
      style={{
        minHeight: "auto",
        padding: "0",
        border: "0",
        borderRadius: "0",
        background: "transparent",
        boxShadow: "none",
        color: "rgba(255, 255, 255, 0.55)",
        fontSize: "0.8rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
      }}
    >
      {children}
    </a>
  );
}

function uniqueMedia(items) {
  const seen = new Set();

  return (items || []).filter((item) => {
    if (!item?.id || seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function fillMediaSlots(items, count) {
  const cleanItems = (items || []).filter(Boolean);

  if (!cleanItems.length) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => cleanItems[index % cleanItems.length]);
}

function buildStaticHomepageMedia() {
  const fallbackVideos = (siteData.featuredVideos || []).map((item, index) => ({
    id: `homepage-static-video-${index}`,
    kind: "video",
    title: item.title,
    description: item.description,
    url: item.href || item.src || "",
    playbackUrl: item.playbackUrl || item.src || null,
    posterUrl: item.poster || siteData.mediaGallery?.[index]?.src || siteData.mediaGallery?.[0]?.src || null,
    thumbnailUrl: item.poster || siteData.mediaGallery?.[index]?.src || siteData.mediaGallery?.[0]?.src || null,
    embedUrl: item.embedUrl || null,
    platform: item.platform || null,
    provider: item.provider || "static"
  }));

  return {
    videos: fallbackVideos,
    home: {
      heroVideo: fallbackVideos[0] || null,
      secondaryVideo: fallbackVideos[1] || fallbackVideos[0] || null,
      tertiaryVideo: fallbackVideos[2] || fallbackVideos[1] || fallbackVideos[0] || null,
      backgroundVideos: fallbackVideos.slice(0, 3),
      featuredVideos: fallbackVideos
    }
  };
}

export default async function HomePage() {
  const {
    brand,
    hero,
    primaryLinks,
    socialLinks,
    streamingPlans,
    featuredMerch,
    shop
  } = siteData;
  const liveConfig = getLiveConfig();

  let media = buildStaticHomepageMedia();

  try {
    media = await getHomepageMedia();
  } catch {
    media = buildStaticHomepageMedia();
  }

  const homepageMedia = media.home;
  const eligibleLibraryVideos = (media.videos || []).filter(
    (item) =>
      item?.kind === "video" &&
      item.active !== false &&
      item.isHidden !== true &&
      item.moderationStatus !== "rejected"
  );
  const uniqueVideoPool = uniqueMedia([
    homepageMedia.heroVideo,
    homepageMedia.secondaryVideo,
    homepageMedia.tertiaryVideo,
    ...(homepageMedia.backgroundVideos || []),
    ...(homepageMedia.featuredVideos || []),
    ...eligibleLibraryVideos
  ]);
  const prioritizedVideos = fillMediaSlots(uniqueVideoPool, 9);
  const primaryLinksWithoutShop = primaryLinks.filter((item) => item.platform !== "shop");
  const galleryLink = {
    title: "Photo Gallery",
    description: "See Brooke's image thumbnails and featured photos in one place.",
    href: "/gallery"
  };
  const homepageLinks = [...primaryLinksWithoutShop, galleryLink];
  const merchLink = primaryLinks.find((item) => item.platform === "shop") || null;

  const featuredVideos = prioritizedVideos.slice(0, 3);
  const featureLeadVideo = featuredVideos[0] || null;
  const reelVideos = prioritizedVideos.slice(3, 9);

  const trackedMediaIds = prioritizedVideos.map((item) => item?.id).filter(Boolean);

  return (
    <main className="page-shell">
      {liveConfig.isLiveOverride ? (
        <a
          href="/live"
          style={{
            display: "block",
            margin: "0 auto 1rem",
            padding: "0.8rem 1rem",
            maxWidth: "min(1200px, calc(100% - 2rem))",
            border: "1px solid rgba(255, 77, 141, 0.35)",
            borderRadius: "999px",
            background: "linear-gradient(90deg, rgba(255, 77, 141, 0.18), rgba(145, 70, 255, 0.22))",
            color: "inherit",
            textDecoration: "none",
            textAlign: "center",
            fontSize: "0.86rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 18px 40px rgba(9, 6, 18, 0.28)"
          }}
        >
          🔴 LIVE NOW — Watch Brooke
        </a>
      ) : null}
      <HomeAnalytics mediaIds={[...new Set(trackedMediaIds)]} />
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <div className="ambient-grid" aria-hidden="true" />

      <section className="hero hero--leopard-photo">
        <div className="hero__print-wrap" aria-hidden="true">
          <img className="hero__print-photo" src="/images/leopard-print-bg.png" alt="" />
          <div className="hero__video-overlay" />
        </div>

        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-lockup__avatar-frame">
              <img src="/images/brooke-tiktok-avatar.jpg" alt="Brooke TikTok avatar" loading="eager" decoding="async" />
            </div>
            <div className="brand-lockup__copy">
              <img
                className="brand-lockup__logo"
                src="/images/DBlogo2.png"
                alt={brand.name + " logo"}
                loading="eager"
                decoding="async"
              />
              <p className="brand-lockup__tagline">{brand.label}</p>
            </div>
          </div>
          <nav className="topbar__actions" aria-label="Site actions">
            <TrackableLink href={shop.shopUrl} eventLabel="Visit shop">
              Visit shop
            </TrackableLink>
          </nav>
        </header>

        <div className="hero__intro">
          <div className="hero__content">
            <span className="status-pill">{hero.status}</span>
            <h2>{hero.headline}</h2>
            <p>{hero.description}</p>

            <div className="hero__actions">
              <SocialCta item={{ label: hero.primaryCta.label, href: hero.primaryCta.href, platform: hero.primaryCta.platform }} />
              <SocialCta item={{ label: hero.secondaryCta.label, href: hero.secondaryCta.href, platform: hero.secondaryCta.platform }} secondary />
            </div>

            <div className="hero__stats">
              {hero.highlights.map((item) => (
                <article key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.copy}</span>
                </article>
              ))}
            </div>
          </div>
        </div>

        {featuredVideos.length ? (
          <div className="hero__video-library" aria-label="Featured videos">
            {featuredVideos.map((item, index) => (
              <VideoCard
                key={`${item.id}-featured-${index}`}
                item={item}
                autoPlay
                muted
                showBody={false}
                className="video-card video-card--library video-card--library-feature"
              />
            ))}
          </div>
        ) : null}

        {reelVideos.length ? (
          <div className="hero__reel-strip hero__reel-strip--library" aria-label="Video reel library">
            {reelVideos.map((item, index) => (
              <VideoCard
                key={`${item.id}-reel-${index}`}
                item={item}
                autoPlay
                muted
                showBody={false}
                className="video-card video-card--library video-card--library-reel"
              />
            ))}
          </div>
        ) : null}

        <div className="hero__ticker">
          {socialLinks.map((item) => (
            <SocialLinkCard
              key={item.label}
              item={item}
              className={getPlatformClass("hero__ticker-link", item.platform)}
            />
          ))}
        </div>
      </section>

      <section className="section section--media section--media-compact">
        <SectionHeading
          eyebrow="Featured"
          title="Start with the clips."
          description="The best clips, right up top."
        />

        <div className={`feature-rank-grid feature-rank-grid--video-only${featureLeadVideo ? "" : " feature-rank-grid--copy-only"}`}>
          {featureLeadVideo ? <VideoCard item={featureLeadVideo} className="video-card feature-rank-card feature-rank-card--video" /> : null}

          <article className="feature-rank-card feature-rank-card--copy">
            <p className="feature-rank-card__eyebrow">About Brooke</p>
            <h3>The kind of woman who makes life look like it has a soundtrack.</h3>
            <ul>
              {hero.panelItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section section--links">
        <SectionHeading
          eyebrow="Start Here"
          title="Watch, book, or keep up."
          description="Every link has a purpose. Pick yours."
        />

        <div className="link-grid">
          {homepageLinks.map((item) => (
            <LinkCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section className="section section--split">
        <div>
          <SectionHeading
            eyebrow="Live Lane"
            title="Live is coming. The door's already open."
            description="Brooke's Twitch channel is ready — follow now so you don't miss the first stream."
          />
          <div className="plan-list">
            {streamingPlans.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <SectionHeading
            eyebrow="Channels"
            title="Find Brooke everywhere."
            description="Short clips, live streams, long-form content, and more."
          />
          <div className="social-list">
            {socialLinks.map((item) => (
              <SocialLinkCard
                key={item.label}
                item={item}
                className={getPlatformClass("social-link", item.platform)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--shop">
        <SectionHeading
          eyebrow="Merch"
          title="Grab something before you go."
          description="Real merch made for people who actually watch."
        />

        <div className="merch-grid">
          {featuredMerch.map((item) => (
            <MerchCard key={item.name} item={item} />
          ))}
        </div>

        <div className="shop-cta">
          <p>{shop.description}</p>
          <TrackableLink href={shop.shopUrl} eventLabel="Open the full store">
            Open the full store
          </TrackableLink>
        </div>
      </section>

      <footer className="site-footer">
        <span>Drum Blonde</span>
        <MinimalFooterLink href="/admin/login">Admin Login</MinimalFooterLink>
      </footer>
    </main>
  );
}
