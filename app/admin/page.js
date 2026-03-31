import { logoutAction, ingestMediaAction, queueAssetAction, reviewAssetAction, runJobsAction } from "@/app/admin/actions";
import GooglePhotosPickerPanel from "@/components/google-photos-picker-panel";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusPill } from "@/components/ui";
import { getEnvironmentChecklist } from "@/core/env";
import { getGooglePhotosPickerConnectionStatus } from "@/core/google-photos-picker";
import { getDestinationPlatforms } from "@/core/platforms";
import { getDashboardSnapshot } from "@/core/repository";
import { requireDashboardUser } from "@/core/auth";

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderNotice(notice, error) {
  if (error) return <div className="inline-alert inline-alert--error">{error}</div>;
  if (!notice) return null;
  const labels = {
    uploaded: "Media ingested and prepared.",
    approved: "Asset approved and queued.",
    rejected: "Asset rejected.",
    revision_requested: "Revision requested.",
    queued: "Publishing targets queued.",
    "worker-ran": "Worker run completed.",
    demo: "Demo mode action completed without persistence.",
    "duplicate-warning": "Asset uploaded, but a duplicate match was found.",
    "google-linked": "Google Photos was connected with the current Picker scope.",
    "google-disconnected": "Google Photos was disconnected from this admin browser."
  };
  return <div className="inline-alert">{labels[notice] || notice}</div>;
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function getPhotoRailItems(snapshot) {
  const base = snapshot.assets
    .map((asset) => ({
      id: asset.id,
      src: asset.thumbnailUrl || (asset.mimeType.startsWith("image/") ? asset.publicUrl : null),
      alt: asset.title
    }))
    .filter((item) => item.src);

  if (!base.length) {
    return [];
  }

  const expanded = [];
  while (expanded.length < 10) {
    expanded.push(...base);
  }

  return expanded.slice(0, 10);
}

function DashboardTab({ snapshot }) {
  return (
    <>
      <div className="metric-grid">
        <MetricCard label="Assets" value={snapshot.assets.length} />
        <MetricCard label="Pending approvals" value={countBy(snapshot.assets, (asset) => asset.approvalStatus === "pending")} tone="warning" />
        <MetricCard label="Queued jobs" value={countBy(snapshot.jobs, (job) => job.status === "queued" || job.status === "scheduled")} tone="accent" />
        <MetricCard label="Manual handoffs" value={countBy(snapshot.jobs, (job) => job.status === "manual_action_required")} tone="warning" />
      </div>
      <div className="content-grid content-grid--two">
        <SectionCard title="Recent assets" meta="Latest media entering the control center.">
          <div className="list-stack">
            {snapshot.assets.slice(0, 4).map((asset) => (
              <article key={asset.id} className="asset-row">
                <div>
                  <strong>{asset.title}</strong>
                  <p>{asset.tags.join(" | ") || "No tags yet"}</p>
                </div>
                <div className="row-meta">
                  <StatusPill tone={asset.approvalStatus === "approved" ? "good" : asset.approvalStatus === "pending" ? "warn" : "soft"}>{asset.approvalStatus}</StatusPill>
                  <span>{formatDate(asset.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Connector stance" meta="Official capabilities vs current safe execution.">
          <div className="list-stack">
            {snapshot.policies.map((policy) => (
              <article key={policy.platform} className="policy-row">
                <div>
                  <strong>{policy.label}</strong>
                  <p>{policy.officialAutomation}</p>
                </div>
                <StatusPill tone={policy.mvpExecution.includes("Manual") ? "warn" : "good"}>{policy.mvpExecution}</StatusPill>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

async function LibraryTab({ snapshot }) {
  const destinations = getDestinationPlatforms();
  const googlePhotosPicker = await getGooglePhotosPickerConnectionStatus();

  return (
    <div className="content-grid">
      <GooglePhotosPickerPanel
        pickerReady={googlePhotosPicker.ready}
        missingEnv={googlePhotosPicker.missing}
        connectionDetail={googlePhotosPicker.detail}
        requiredScope={googlePhotosPicker.requiredScope}
        actionHref={googlePhotosPicker.actionHref}
        actionLabel={googlePhotosPicker.actionLabel}
        connected={googlePhotosPicker.connected}
        source={googlePhotosPicker.source}
      />
      <SectionCard title="Ingest media" meta="Upload once, fingerprint once, caption once, distribute safely.">
        <form action={ingestMediaAction} className="stack-form">
          <div className="form-grid">
            <label><span>Media file</span><input name="media" type="file" accept="video/*,image/*" required /></label>
            <label><span>Title</span><input name="title" placeholder="Double-kick warmup burst" /></label>
            <label>
              <span>Source platform</span>
              <select name="sourcePlatform" defaultValue="upload">
                <option value="upload">Local upload</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube_shorts">YouTube Shorts</option>
                <option value="twitch">Twitch clip</option>
                <option value="library">Source library</option>
              </select>
            </label>
            <label><span>Schedule</span><input name="scheduledFor" type="datetime-local" /></label>
            <label><span>Campaign</span><input name="campaign" placeholder="spring-practice" /></label>
            <label>
              <span>Voice preset</span>
              <select name="voicePreset" defaultValue="drummer_girl">
                <option value="playful">Playful</option>
                <option value="drummer_girl">Drummer girl / music creator</option>
                <option value="confident">Confident</option>
                <option value="flirty_safe">Flirty but safe</option>
                <option value="livestream_growth">Livestream growth</option>
              </select>
            </label>
          </div>
          <label><span>Description</span><textarea name="description" rows={3} placeholder="Use the strongest hook from the clip and keep the angle clear." /></label>
          <div className="form-grid">
            <label><span>Tags</span><input name="tags" placeholder="practice clip, viral candidate, music influencer" /></label>
            <label><span>Source URL</span><input name="sourceUrl" placeholder="https://..." /></label>
          </div>
          <label><span>Creator notes</span><textarea name="creatorNotes" rows={2} placeholder="Notes for approval, edit angle, or scheduling context." /></label>
          <label>
            <span>Approval mode</span>
            <select name="approvalPolicy" defaultValue="human_required">
              <option value="human_required">Human approval required</option>
              <option value="auto_post_approved_only">Auto-post approved-only</option>
            </select>
          </label>
          <fieldset className="checkbox-grid">
            <legend>Destinations</legend>
            {destinations.map((platform) => (
              <label key={platform.platform} className="checkbox-chip">
                <input type="checkbox" name="destinations" value={platform.platform} defaultChecked={platform.platform !== "reddit"} />
                <span>{platform.label}</span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="primary-button">Ingest and prepare asset</button>
        </form>
      </SectionCard>
      <SectionCard title="Content library" meta="Media library with duplicate risk, platform targets, and approval state.">
        {snapshot.assets.length ? (
          <div className="asset-grid">
            {snapshot.assets.map((asset) => (
              <article key={asset.id} className="asset-card">
                {asset.publicUrl && asset.mimeType.startsWith("video/") ? (
                  <video className="asset-card__media" controls preload="metadata" poster={asset.thumbnailUrl || undefined}><source src={asset.publicUrl} type={asset.mimeType} /></video>
                ) : asset.thumbnailUrl ? (
                  <img className="asset-card__media" src={asset.thumbnailUrl} alt={asset.title} />
                ) : (
                  <div className="asset-card__media asset-card__media--placeholder">Preview unavailable</div>
                )}
                <div className="asset-card__body">
                  <div className="asset-card__head">
                    <strong>{asset.title}</strong>
                    <StatusPill tone={asset.duplicateRisk === "clear" ? "good" : "warn"}>{asset.duplicateRisk}</StatusPill>
                  </div>
                  <p>{asset.description || "No description yet."}</p>
                  <small>{asset.tags.join(" | ") || "No tags"}</small>
                  <div className="badge-row">
                    <StatusPill tone={asset.approvalStatus === "approved" ? "good" : asset.approvalStatus === "pending" ? "warn" : "soft"}>{asset.approvalStatus}</StatusPill>
                    <StatusPill>{asset.status}</StatusPill>
                    {asset.targets.map((target) => <StatusPill key={target.id} tone={target.status.includes("manual") ? "warn" : "soft"}>{target.platform}</StatusPill>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No media yet" copy="Upload Brooke's first approved clip to start the pipeline." />}
      </SectionCard>
    </div>
  );
}

function ApprovalsTab({ snapshot }) {
  const pending = snapshot.assets.filter((asset) => asset.approvalStatus === "pending");
  if (!pending.length) return <EmptyState title="Approval queue is clear" copy="New assets that require a human sign-off will appear here." />;

  return (
    <div className="list-stack">
      {pending.map((asset) => (
        <SectionCard key={asset.id} title={asset.title} meta={`${asset.tags.join(" | ") || "No tags"} | ${asset.targets.length} destinations`}>
          <div className="approval-card">
            <div>
              <p>{asset.description || "No caption summary yet."}</p>
              <div className="badge-row">
                {asset.targets.map((target) => <StatusPill key={target.id} tone={target.executionMode === "manual_handoff" ? "warn" : "good"}>{target.platform}</StatusPill>)}
              </div>
            </div>
            <div className="inline-actions">
              <form action={reviewAssetAction}><input type="hidden" name="assetId" value={asset.id} /><input type="hidden" name="decision" value="approved" /><button className="primary-button" type="submit">Approve</button></form>
              <form action={reviewAssetAction}><input type="hidden" name="assetId" value={asset.id} /><input type="hidden" name="decision" value="revision_requested" /><button className="ghost-button" type="submit">Request revision</button></form>
              <form action={reviewAssetAction}><input type="hidden" name="assetId" value={asset.id} /><input type="hidden" name="decision" value="rejected" /><button className="danger-button" type="submit">Reject</button></form>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function ScheduleTab({ snapshot }) {
  const manual = snapshot.jobs.filter((job) => job.status === "manual_action_required");
  return (
    <div className="content-grid content-grid--two">
      <SectionCard title="Publish jobs" meta="Scheduled, queued, and manual-review states from the worker queue.">
        <form action={runJobsAction} className="inline-actions inline-actions--spaced"><button type="submit" className="primary-button">Run worker now</button></form>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Asset</th><th>Platform</th><th>Status</th><th>Run at</th><th>Notes</th></tr></thead>
            <tbody>
              {snapshot.jobs.map((job) => (
                <tr key={job.id}><td>{job.assetTitle}</td><td>{job.platform}</td><td>{job.status}</td><td>{formatDate(job.runAt)}</td><td>{job.workerNotes || "-"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <SectionCard title="Ready to queue" meta="Approved assets can be re-queued manually if needed.">
        <div className="list-stack">
          {snapshot.assets.filter((asset) => asset.approvalStatus === "approved").map((asset) => (
            <article key={asset.id} className="policy-row">
              <div><strong>{asset.title}</strong><p>{asset.targets.map((target) => `${target.platform}: ${target.status}`).join(" | ")}</p></div>
              <form action={queueAssetAction}><input type="hidden" name="assetId" value={asset.id} /><button className="ghost-button" type="submit">Queue again</button></form>
            </article>
          ))}
        </div>
        {manual.length ? <div className="manual-box"><strong>Manual handoff queue</strong><p>{manual.length} job(s) require a human publish handoff because the connector is intentionally conservative.</p></div> : null}
      </SectionCard>
    </div>
  );
}

function LogsTab({ snapshot }) {
  return (
    <div className="content-grid content-grid--two">
      <SectionCard title="Publish attempts" meta="Worker attempts and prepared manual handoffs.">
        <div className="list-stack">
          {snapshot.attempts.map((attempt) => (
            <article key={attempt.id} className="asset-row">
              <div><strong>{attempt.assetTitle}</strong><p>{attempt.platform} | {attempt.responseExcerpt || "No response excerpt"}</p></div>
              <div className="row-meta"><StatusPill tone={attempt.status.includes("manual") ? "warn" : attempt.status === "failed" ? "bad" : "soft"}>{attempt.status}</StatusPill><span>{formatDate(attempt.startedAt)}</span></div>
            </article>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Audit trail" meta="Every meaningful workflow action lands here.">
        <div className="list-stack">
          {snapshot.auditLogs.map((log) => (
            <article key={log.id} className="asset-row">
              <div><strong>{log.eventType}</strong><p>{log.message}</p></div>
              <div className="row-meta"><StatusPill tone={log.severity === "error" ? "bad" : log.severity === "warning" ? "warn" : "soft"}>{log.severity}</StatusPill><span>{formatDate(log.createdAt)}</span></div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function SettingsTab({ snapshot }) {
  const checklist = getEnvironmentChecklist();
  return (
    <div className="content-grid content-grid--two">
      <SectionCard title="Environment contract" meta="Required secrets and runtime flags for production.">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Variable</th><th>Status</th><th>Required</th><th>Purpose</th></tr></thead>
            <tbody>{checklist.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.configured ? "Configured" : "Missing"}</td><td>{item.required ? "Yes" : "Optional"}</td><td>{item.purpose}</td></tr>)}</tbody>
          </table>
        </div>
      </SectionCard>
      <SectionCard title="Connected accounts" meta="Store only Brooke-owned destinations and official scopes.">
        {snapshot.accounts.length ? <div className="list-stack">{snapshot.accounts.map((account) => <article key={account.id} className="policy-row"><div><strong>{account.label}</strong><p>{account.platform} | {account.handle || "No handle saved"}</p></div><div className="row-meta"><StatusPill tone={account.status.toLowerCase().includes("ready") ? "good" : "warn"}>{account.status}</StatusPill><span>{account.publishMode}</span></div></article>)}</div> : <EmptyState title="No accounts linked" copy="Use official OAuth per platform before enabling live direct publishing." />}
      </SectionCard>
      <SectionCard title="Platform policy" meta="Clear separation between official capability and current execution mode.">
        <div className="list-stack">{snapshot.policies.map((policy) => <article key={policy.platform} className="policy-row policy-row--stacked"><strong>{policy.label}</strong><p>{policy.officialAutomation}</p><small>{policy.mvpExecution}</small></article>)}</div>
      </SectionCard>
    </div>
  );
}

export default async function AdminPage({ searchParams }) {
  const user = await requireDashboardUser();
  const params = await searchParams;
  const tab = String(params?.tab || "dashboard").trim();
  const notice = String(params?.notice || "").trim();
  const error = String(params?.error || "").trim();
  const snapshot = await getDashboardSnapshot(user);
  const photoRailItems = getPhotoRailItems(snapshot);
  const leftRailItems = photoRailItems.filter((_, index) => index % 2 === 0);
  const rightRailItems = photoRailItems.filter((_, index) => index % 2 === 1);

  let content = <DashboardTab snapshot={snapshot} />;
  if (tab === "library") content = await LibraryTab({ snapshot });
  if (tab === "approvals") content = <ApprovalsTab snapshot={snapshot} />;
  if (tab === "schedule") content = <ScheduleTab snapshot={snapshot} />;
  if (tab === "logs") content = <LogsTab snapshot={snapshot} />;
  if (tab === "settings") content = <SettingsTab snapshot={snapshot} />;

  return (
    <main className="dashboard-stage">
      <aside className="photo-rail photo-rail--left" aria-hidden="true">
        {leftRailItems.map((item, index) => <img key={`${item.id}-${index}`} className="photo-rail__tile" src={item.src} alt={item.alt} />)}
      </aside>
      <div className="page-stack page-stack--dashboard">
        <PageHeader
          eyebrow="Creator Distribution Control Center"
          title="Ingest once, approve once, distribute safely."
          description="This admin workspace keeps Brooke's drum and music content inside an auditable workflow with duplicate protection, prepared captions, and queue-first publishing."
          actions={<form action={logoutAction}><button className="ghost-button" type="submit">Sign out</button></form>}
        />
        {renderNotice(notice, error)}
        {content}
      </div>
      <aside className="photo-rail photo-rail--right" aria-hidden="true">
        {rightRailItems.map((item, index) => <img key={`${item.id}-${index}`} className="photo-rail__tile" src={item.src} alt={item.alt} />)}
      </aside>
    </main>
  );
}
