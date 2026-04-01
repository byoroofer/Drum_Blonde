const featureCards = [
  {
    title: "Streaming-first",
    body: "Live drumming, quick clips, and creator energy all in one path."
  },
  {
    title: "Short-form ready",
    body: "Watch-now clips stay front and center instead of buried in links."
  },
  {
    title: "Shop-friendly",
    body: "Music, creator offers, and future merch can sit below the fold."
  }
];

const quickLinks = [
  { label: "TikTok", tone: "cyan" },
  { label: "Twitch", tone: "violet" },
  { label: "Instagram", tone: "pink" },
  { label: "YouTube", tone: "rose" }
];

const clipNotes = [
  "Lead with Brooke's strongest visual hooks instead of a plain bio block.",
  "Keep stream, follow, and shop paths visible without cluttering the hero.",
  "Use stacked media cards so the page feels alive before anyone scrolls.",
  "Leave room for future merch, booking, and sponsor links under the fold."
];

const platformRows = [
  { label: "TikTok", detail: "Fast drum hooks and daily clip momentum." },
  { label: "Twitch", detail: "Live sessions, chat, and longer-form personality." },
  { label: "Instagram", detail: "Photo drops, reels, and creator-brand updates." },
  { label: "YouTube", detail: "Longer edits, highlights, and feature uploads." }
];

export default function HomePage() {
  return (
    <main className="homepage-shell">
      <section className="homepage-hero">
        <div className="homepage-hero__frame">
          <header className="homepage-topbar">
            <div className="homepage-brand">
              <img className="homepage-brand__avatar" src="/images/brooke-tiktok-avatar.jpg" alt="Brooke avatar" />
              <img className="homepage-brand__logo" src="/images/DBlogo2.png" alt="Drum Blonde logo" />
            </div>

            <div className="homepage-topbar__actions">
              <a className="homepage-pill homepage-pill--accent" href="#clips">Watch now</a>
              <a className="homepage-pill homepage-pill--accent" href="#platform-links">Shop links</a>
            </div>
          </header>

          <div className="homepage-brandline">Official Creator Hub</div>

          <div className="homepage-hero__grid">
            <div className="homepage-hero__copycard">
              <div className="homepage-kicker">Drum Blonde</div>
              <h1 className="homepage-display">Watch Brooke drum first. Follow, stream, and shop after.</h1>
              <p className="homepage-lead">
                Short-form clips, creator updates, livestream energy, and direct platform paths all stay inside one page that feels current.
              </p>

              <div className="homepage-actions">
                <a className="homepage-button homepage-button--primary" href="#clips">Watch the latest clip</a>
                <a className="homepage-button homepage-button--ghost" href="#platform-links">Open social hub</a>
              </div>

              <div className="homepage-feature-grid">
                {featureCards.map((card) => (
                  <article key={card.title} className="homepage-feature-card">
                    <strong>{card.title}</strong>
                    <p>{card.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="homepage-media-stack">
              <article className="homepage-media-card homepage-media-card--tall">
                <img src="/media/brooke-01.jpg" alt="Brooke smiling for a portrait" />
                <span>featured now</span>
              </article>

              <article className="homepage-media-card homepage-media-card--short">
                <img src="/media/brooke-02.jpg" alt="Brooke close-up portrait" />
                <span>play this next</span>
              </article>
            </div>
          </div>

          <div className="homepage-bottom-strip">
            <article className="homepage-mini-panel homepage-mini-panel--video">
              <video autoPlay loop muted playsInline preload="metadata">
                <source src="/media/brooke-clip-02.mp4" type="video/mp4" />
              </video>
              <div>
                <small>Featured Brooke clip</small>
                <strong>Real audience energy, fast hooks, and direct creator access.</strong>
              </div>
            </article>

            <article className="homepage-mini-panel homepage-mini-panel--text">
              <small>This works because</small>
              <ul>
                <li>People see Brooke immediately instead of reading a wall of copy.</li>
                <li>Follow, stream, and shop all feel one click away.</li>
                <li>The page feels active before any social embeds load.</li>
              </ul>
            </article>
          </div>

          <div className="homepage-social-row" id="platform-links">
            {quickLinks.map((item) => (
              <a key={item.label} className={`homepage-social-pill homepage-social-pill--${item.tone}`} href="#clips">
                <span className="homepage-social-pill__dot" />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section" id="clips">
        <div className="homepage-section__header">
          <span className="homepage-kicker">Featured Content</span>
          <h2>Start with the clips.</h2>
          <p>
            This section keeps Brooke's strongest visual content above the fold and makes every next action feel obvious.
          </p>
        </div>

        <div className="homepage-clips-grid">
          <article className="homepage-showcase-card">
            <img src="/media/brooke-03.jpg" alt="Brooke portrait for creator showcase" />
          </article>

          <article className="homepage-notes-card">
            <div>
              <small>Why this page works</small>
              <strong>This layout makes Brooke feel active before anyone even reaches the links.</strong>
            </div>

            <ul>
              {clipNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>

            <div className="homepage-platform-list">
              {platformRows.map((row) => (
                <div key={row.label} className="homepage-platform-row">
                  <strong>{row.label}</strong>
                  <span>{row.detail}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
