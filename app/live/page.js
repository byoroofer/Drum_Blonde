import TrackableLink from "@/app/components/trackable-link";
import { getLiveConfig } from "@/data/liveConfig";

export const dynamic = "force-dynamic";

function buildTwitchParentParams() {
  return "parent=drumblonde.tjware.me&parent=localhost";
}

export default function LivePage() {
  const liveConfig = getLiveConfig();
  const parentParams = buildTwitchParentParams();
  const channelUrl = `https://www.twitch.tv/${liveConfig.twitchChannel}`;
  const playerSrc = `https://player.twitch.tv/?channel=${liveConfig.twitchChannel}&${parentParams}`;
  const chatSrc = `https://www.twitch.tv/embed/${liveConfig.twitchChannel}/chat?${parentParams}`;

  return (
    <main className="page-shell">
      <style>{`
        .live-page {
          display: grid;
          gap: 1.5rem;
        }

        .live-page__layout {
          display: grid;
          gap: 1.25rem;
          align-items: stretch;
          grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.85fr);
        }

        .live-page__badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          width: fit-content;
          background: rgba(255, 77, 141, 0.16);
          border: 1px solid rgba(255, 77, 141, 0.38);
          box-shadow: 0 12px 30px rgba(255, 77, 141, 0.16);
        }

        .live-page__badge::before {
          content: "";
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          background: #ff4d8d;
          box-shadow: 0 0 0 0 rgba(255, 77, 141, 0.55);
          animation: live-page-pulse 1.8s infinite;
        }

        .live-page__frame {
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 10, 18, 0.82);
          box-shadow: 0 20px 50px rgba(9, 6, 18, 0.32);
        }

        .live-page__frame iframe {
          display: block;
          width: 100%;
          border: 0;
        }

        .live-page__player iframe {
          aspect-ratio: 16 / 9;
          min-height: 420px;
        }

        .live-page__chat iframe {
          min-height: 100%;
          height: 100%;
        }

        .live-page__chat {
          min-height: 640px;
        }

        .live-page__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
          align-items: center;
        }

        .live-page__follow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0.9rem 1.25rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #9146ff, #ff4d8d);
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          box-shadow: 0 16px 34px rgba(145, 70, 255, 0.28);
        }

        .live-page__note {
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
        }

        .live-page__clip-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .live-page__clip-card {
          min-height: 180px;
          justify-content: space-between;
        }

        .live-page__clip-card p,
        .live-page__clip-card span {
          display: block;
        }

        .live-page__clip-card p {
          margin: 0 0 0.55rem;
          font-size: 1rem;
          font-weight: 700;
        }

        .live-page__clip-card span {
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
        }

        @keyframes live-page-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 77, 141, 0.55);
          }
          70% {
            box-shadow: 0 0 0 12px rgba(255, 77, 141, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 77, 141, 0);
          }
        }

        @media (max-width: 960px) {
          .live-page__layout {
            grid-template-columns: 1fr;
          }

          .live-page__player iframe {
            min-height: 280px;
          }

          .live-page__chat {
            min-height: 480px;
          }
        }
      `}</style>

      <section className="section live-page">
        <div className="section-heading">
          <span>On Air</span>
          <h1>Catch Brooke live on Twitch.</h1>
          <p>Watch the stream, keep the chat open, and stay ready for clips to land here after each session.</p>
        </div>

        <span className="status-pill live-page__badge">LIVE</span>

        <div className="live-page__layout">
          <div className="live-page__frame live-page__player">
            <iframe
              src={playerSrc}
              title="Drum Blonde Twitch stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {liveConfig.showChat ? (
            <div className="live-page__frame live-page__chat">
              <iframe src={chatSrc} title="Drum Blonde Twitch chat" />
            </div>
          ) : null}
        </div>

        <div className="live-page__actions">
          <TrackableLink className="live-page__follow" href={channelUrl} eventLabel="Follow Brooke on Twitch from live page">
            Follow on Twitch
          </TrackableLink>
          <p className="live-page__note">Twitch clips and replay highlights will slot in below this player.</p>
        </div>
      </section>

      <section className="section section--links">
        <div className="section-heading">
          <span>Clips</span>
          <h2>Clips are queued for this space.</h2>
          <p>Short-form moments can drop here later without changing the live layout above.</p>
        </div>

        <div className="live-page__clip-grid">
          <article className="link-card link-card--twitch live-page__clip-card">
            <div className="link-card__main">
              <div className="link-card__copy">
                <p>Top moments placeholder</p>
                <span>Featured Twitch clips can surface here after each stream.</span>
              </div>
            </div>
          </article>

          <article className="link-card link-card--twitch live-page__clip-card">
            <div className="link-card__main">
              <div className="link-card__copy">
                <p>Recent stream highlights</p>
                <span>VOD cutdowns and standout chat moments can be pinned here later.</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
