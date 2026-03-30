import Link from "next/link";
import { ARCHITECTURE_LAYERS, FOLDER_BLUEPRINT } from "@/core/blueprint";
import { getPlatformPolicyList } from "@/core/platforms";

export default function HomePage() {
  const policies = getPlatformPolicyList();

  return (
    <main className="landing-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Phase 1 Blueprint</span>
          <h1>Brooke's creator distribution system is designed around one ingest path, auditable approvals, and safe platform execution.</h1>
          <p>
            The app below uses official-account assumptions, avoids fake engagement automation, and defaults to manual handoff anywhere direct posting should not be faked.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/admin">Open Admin Dashboard</Link>
            <a className="ghost-button" href="#platform-matrix">See platform matrix</a>
          </div>
        </div>
        <div className="hero-grid">
          {ARCHITECTURE_LAYERS.map((item) => (
            <article key={item.title} className="highlight-card">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-head">
          <span className="eyebrow">Exact Folder Structure</span>
          <h2>MVP layout</h2>
        </div>
        <pre className="code-block">{FOLDER_BLUEPRINT.join("\n")}</pre>
      </section>

      <section className="content-panel" id="platform-matrix">
        <div className="panel-head">
          <span className="eyebrow">Official Automation Matrix</span>
          <h2>What can be automated vs what stays manual</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Official automation</th>
                <th>MVP execution</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((item) => (
                <tr key={item.platform}>
                  <td>{item.label}</td>
                  <td>{item.officialAutomation}</td>
                  <td>{item.mvpExecution}</td>
                  <td>{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

