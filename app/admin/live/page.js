import { revalidatePath } from "next/cache";
import { getLiveConfig, setLiveOverride } from "@/data/liveConfig";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function updateLiveModeAction(formData) {
  "use server";

  await requireAdmin();
  setLiveOverride(formData.get("isLiveOverride") === "on");
  revalidatePath("/");
  revalidatePath("/live");
  revalidatePath("/admin/live");
}

export default async function AdminLivePage() {
  await requireAdmin();

  const liveConfig = getLiveConfig();
  const channelUrl = `https://www.twitch.tv/${liveConfig.twitchChannel}`;
  const dashboardUrl = `https://dashboard.twitch.tv/u/${liveConfig.twitchChannel}/home`;

  return (
    <div className="admin-shell">
      <section className="admin-header-card">
        <div>
          <p className="admin-kicker">Live Stream Console</p>
          <h1>Manage the Twitch live surface without touching media or homepage layout.</h1>
          <p>
            This console only controls the temporary live banner and live page state.
            Twitch remains the stream source.
          </p>
        </div>

        <div className="admin-header-actions">
          <a className="admin-ghost-button" href={channelUrl} target="_blank" rel="noreferrer">
            Open Twitch channel
          </a>
          <a className="admin-ghost-button" href={dashboardUrl} target="_blank" rel="noreferrer">
            Open Twitch dashboard
          </a>
        </div>
      </section>

      <section className="admin-board-card">
        <div className="admin-board-grid">
          <section className="admin-collapsible admin-collapsible--card">
            <div className="admin-collapsible__body">
              <div className="admin-collapsible__summary">
                <div>
                  <p className="admin-kicker">Stream Status</p>
                  <h2>Homepage and /live controls</h2>
                  <p>Use the toggle below to manually expose the live banner and keep the live page flagged as active.</p>
                </div>
                <div className="admin-collapsible__aside">
                  <span className="admin-pill">{liveConfig.isLiveOverride ? "Live mode on" : "Live mode off"}</span>
                </div>
              </div>

              <form action={updateLiveModeAction} className="admin-form-stack">
                <label className="admin-field">
                  <span>Stream title</span>
                  <input defaultValue="Brooke is live on Twitch" placeholder="UI only for now" />
                </label>

                <label className="admin-check">
                  <input name="isLiveOverride" type="checkbox" defaultChecked={liveConfig.isLiveOverride} />
                  <span>Set Live Mode</span>
                </label>

                <p className="admin-note">
                  This is a temporary in-memory switch. It updates the homepage live strip and the live page immediately for the current running app instance.
                </p>

                <div className="admin-media-actions">
                  <button type="submit">Save live mode</button>
                </div>
              </form>
            </div>
          </section>

          <section className="admin-collapsible admin-collapsible--card">
            <div className="admin-collapsible__body">
              <div className="admin-collapsible__summary">
                <div>
                  <p className="admin-kicker">Quick Links</p>
                  <h2>Twitch access</h2>
                  <p>Jump straight to the public channel or the creator dashboard.</p>
                </div>
              </div>

              <div className="admin-media-actions">
                <a className="admin-ghost-button" href={channelUrl} target="_blank" rel="noreferrer">
                  Open Twitch channel
                </a>
                <a className="admin-ghost-button" href={dashboardUrl} target="_blank" rel="noreferrer">
                  Open Twitch dashboard
                </a>
                <a className="admin-ghost-button" href="/live" target="_blank" rel="noreferrer">
                  Open /live
                </a>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
