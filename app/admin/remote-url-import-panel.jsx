"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RemoteUrlImportPanel({ importEnabled, missingConfig = [] }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [remoteUrl, setRemoteUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("google-import, drumbrooke");
  const [manualRank, setManualRank] = useState("0");
  const [homeSlot, setHomeSlot] = useState("");
  const [featuredHome, setFeaturedHome] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("approved");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const disabled = !importEnabled || isSubmitting || isRefreshing;

  async function handleSubmit(event) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    setIsSubmitting(true);
    setStatus("Importing remote media into storage...");
    setResult(null);

    try {
      const response = await fetch("/api/admin/import/remote-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          remoteUrl,
          source: "remote_url",
          title,
          description,
          tags,
          manualRank,
          homeSlot,
          featuredHome,
          workflowStatus,
          active: true
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || payload.error || "Import failed.");
      }

      setResult(payload.asset || null);
      setStatus("Import complete. Library refreshed.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-upload-card admin-import-card">
      <details className="admin-collapsible admin-collapsible--embedded">
        <summary>
          <div className="admin-collapsible__summary">
            <div>
              <p className="admin-kicker">Remote URL</p>
              <h2>Remote URL import</h2>
              <p>Use this when you already have a direct downloadable media URL and just need it ingested into the portal.</p>
            </div>
            <span className="admin-collapsible__meta">Toggle</span>
          </div>
        </summary>

        <div className="admin-collapsible__body">
          <div className="admin-section-heading">
            <div>
              <p>
                External media is treated only as an ingestion path. Once imported, the asset lives in storage
                and is managed exactly like a local upload.
              </p>
            </div>
            <div className="admin-mini-note">
              <strong>Direct fetch only</strong>
              <span>Open this panel only for explicit media files, not Google Photos discovery.</span>
            </div>
          </div>

          {!importEnabled ? (
            <p className="admin-note">Missing configuration: {missingConfig.join(", ") || "storage settings"}.</p>
          ) : null}

          <form className="admin-form-stack" onSubmit={handleSubmit}>
            <label className="admin-field">
              <span>Remote media URL</span>
              <input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://... explicit downloadable media URL" />
            </label>

            <div className="admin-grid admin-grid--compact">
              <label className="admin-field">
                <span>Title override</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional" />
              </label>
              <label className="admin-field">
                <span>Workflow status</span>
                <select value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value)}>
                  <option value="approved">approved</option>
                  <option value="review">review</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>
            </div>

            <label className="admin-field">
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Import context or notes" />
            </label>

            <div className="admin-grid admin-grid--compact admin-grid--triple">
              <label className="admin-field">
                <span>Tags</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Comma-separated tags" />
              </label>
              <label className="admin-field">
                <span>Manual rank</span>
                <input value={manualRank} onChange={(event) => setManualRank(event.target.value)} placeholder="0" />
              </label>
              <label className="admin-field">
                <span>Home slot</span>
                <input value={homeSlot} onChange={(event) => setHomeSlot(event.target.value)} placeholder="Optional" />
              </label>
            </div>

            <label className="admin-check">
              <input type="checkbox" checked={featuredHome} onChange={(event) => setFeaturedHome(event.target.checked)} />
              <span>Feature this import on the homepage immediately</span>
            </label>

            <div className="admin-upload-actions">
              <button type="submit" disabled={disabled}>{isSubmitting ? "Importing..." : "Import remote URL"}</button>
              <small>{status || "Imports an explicitly provided media file. Nothing is deleted or blocked automatically."}</small>
            </div>
          </form>

          {result ? (
            <div className="admin-import-summary">
              <div className="admin-top-grid admin-top-grid--import">
                <div className="admin-top-card">
                  <strong>{result.title}</strong>
                  <span>{result.kind} · {result.mimeType}</span>
                  <small>{result.source} · {result.fileSizeBytes || 0} bytes</small>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

