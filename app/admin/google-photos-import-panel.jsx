"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function formatPolling(ms) {
  return `${Math.max(1, Math.round(Number(ms || 0) / 1000))}s`;
}

function formatPickedType(item) {
  if (item.type === "VIDEO") {
    return "Video";
  }

  if (item.type === "PHOTO") {
    return "Photo";
  }

  return "Media";
}

export default function GooglePhotosImportPanel({ importEnabled, missingRequired = [], missingOptional = [] }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [maxItemCount, setMaxItemCount] = useState("12");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("google-photos, drumbrooke");
  const [manualRank, setManualRank] = useState("0");
  const [homeSlot, setHomeSlot] = useState("");
  const [featuredHome, setFeaturedHome] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("approved");
  const [session, setSession] = useState(null);
  const [pickerToken, setPickerToken] = useState("");
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  const disabled = !importEnabled || isWorking || isRefreshing;

  useEffect(() => {
    if (!session || session.mediaItemsSet) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void pollSession(session.id, false);
    }, session.pollIntervalMs || 3000);

    return () => window.clearTimeout(timeoutId);
  }, [session]);

  useEffect(() => {
    function handleMessage(event) {
      if (!event.data || event.data.type !== "google-photos-oauth") {
        return;
      }
      if (event.data.error) {
        setError(String(event.data.error));
        setStatus("");
        setIsWorking(false);
        return;
      }
      if (event.data.session) {
        const { accessToken, ...nextSession } = event.data.session;
        setSession(nextSession);
        setPickerToken(accessToken || "");
        setItems([]);
        setSelectedIds([]);
        setIsWorking(false);
        setStatus(
          `Picker open in Google Photos. Polling every ${formatPolling(nextSession.pollIntervalMs)} for your selection.`
        );
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function toggleSelectedItem(id) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    ));
  }

  function startPicker() {
    if (disabled) {
      return;
    }

    setIsWorking(true);
    setError("");
    setSummary(null);
    setStatus("Opening Google authorization...");

    const params = new URLSearchParams({ maxItemCount: String(maxItemCount) });
    // Do NOT pass noopener — the callback page needs window.opener to postMessage the session back
    const popup = window.open(`/api/admin/google-photos/oauth/start?${params.toString()}`, "_blank", "width=520,height=640");
    if (!popup) {
      setError("Popup was blocked. Allow popups for this site in your browser, then try again.");
      setStatus("");
      setIsWorking(false);
    }
  }

  async function pollSession(sessionId, manual = true) {
    if (!sessionId) {
      return;
    }

    if (manual) {
      setIsWorking(true);
      setError("");
    }

    try {
      const pollHeaders = pickerToken ? { "X-Picker-Token": pickerToken } : {};
      const response = await fetch(`/api/admin/google-photos/picker/session/${encodeURIComponent(sessionId)}`, { headers: pollHeaders });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to read Google Photos picker session.");
      }

      const nextSession = payload.session;
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      setSession(nextSession);
      setItems(nextItems);
      setSelectedIds((current) => {
        const filtered = current.filter((id) => nextItems.some((item) => item.id === id));
        return filtered.length ? filtered : nextItems.map((item) => item.id);
      });
      setStatus(
        nextSession.mediaItemsSet
          ? `Selection complete. ${nextItems.length} item(s) ready to import.`
          : `Waiting for selection in Google Photos. Polling every ${formatPolling(nextSession.pollIntervalMs)}.`
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to read Google Photos picker session.");
    } finally {
      if (manual) {
        setIsWorking(false);
      }
    }
  }

  async function importSelection() {
    if (!session?.id || disabled || !selectedIds.length) {
      return;
    }

    setIsWorking(true);
    setError("");
    setSummary(null);
    setStatus(`Importing ${selectedIds.length} selected Google Photos item(s)...`);

    try {
      const importHeaders = { "Content-Type": "application/json" };
      if (pickerToken) importHeaders["X-Picker-Token"] = pickerToken;
      const response = await fetch("/api/admin/google-photos/picker/import", {
        method: "POST",
        headers: importHeaders,
        body: JSON.stringify({
          sessionId: session.id,
          selectedIds,
          titlePrefix,
          description,
          tags,
          manualRank,
          homeSlot,
          featuredHome,
          workflowStatus
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to import picked Google Photos media.");
      }

      setSummary(payload.result || null);
      setStatus(
        `Imported ${payload.result?.importedCount || 0} item(s). Failed ${payload.result?.failedCount || 0}. Refreshing library...`
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to import picked Google Photos media.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="admin-upload-card admin-import-card">
      <details className="admin-collapsible admin-collapsible--embedded">
        <summary>
          <div className="admin-collapsible__summary">
            <div>
              <p className="admin-kicker">Google Photos</p>
              <h2>Google Photos picker import</h2>
              <p>Choose items in Google Photos, then import only those picks into the media portal.</p>
            </div>
            <span className="admin-collapsible__meta">Toggle</span>
          </div>
        </summary>

        <div className="admin-collapsible__body">
          <div className="admin-section-heading">
            <div>
              <p>
                This admin now uses Google&apos;s Picker API instead of the older library-wide search path. The picker hands
                control to Google Photos, then the selected items are copied into storage.
              </p>
              <p>
                Open the picker in the same Chrome profile that is already signed into the Google account holding the
                photos you want. If Google Photos opens empty or says it cannot reconnect, start a fresh picker session
                from this panel instead of reusing an old picker tab.
              </p>
            </div>
            <div className="admin-mini-note">
              <strong>Picker-based flow</strong>
              <span>Use the Brooke Google Photos browser profile, then choose the exact files you want to bring into the library.</span>
            </div>
          </div>

          {!importEnabled ? (
            <p className="admin-note">
              Missing Google Photos configuration: {missingRequired.join(", ") || "none"}. Optional smart-import envs: {missingOptional.join(", ") || "none"}.
              Mint the token with <code>https://www.googleapis.com/auth/photospicker.mediaitems.readonly</code>.
            </p>
          ) : null}

          <div className="admin-form-stack">
            <div className="admin-grid admin-grid--compact admin-grid--triple">
              <label className="admin-field">
                <span>Max picks</span>
                <input value={maxItemCount} onChange={(event) => setMaxItemCount(event.target.value)} placeholder="12" />
              </label>
              <label className="admin-field">
                <span>Title prefix</span>
                <input value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} placeholder="Optional title prefix" />
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
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Optional note applied to every imported item" />
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
              <span>Feature imported Google Photos items on the homepage immediately</span>
            </label>

            <div className="admin-upload-actions">
              <button type="button" onClick={startPicker} disabled={disabled}>
                {isWorking && !session ? "Starting..." : "Start Google Photos picker"}
              </button>
              {session ? (
                <button type="button" className="admin-ghost-button" onClick={() => void pollSession(session.id)} disabled={disabled}>
                  Poll selection
                </button>
              ) : null}
              {session?.pickerUri ? (
                <a className="admin-ghost-button" href={session.pickerUri} target="_blank" rel="noopener">
                  Open picker again
                </a>
              ) : null}
              <small>{status || "Use the same browser profile that already has the correct Google Photos account signed in, then choose the files you want to import."}</small>
            </div>
          </div>

          {error ? <p className="admin-note">{error}</p> : null}

          {session ? (
            <div className="admin-import-summary">
              <div className="admin-top-grid admin-top-grid--import">
                <div className="admin-top-card">
                  <strong>{session.mediaItemsSet ? "Ready" : "Waiting"}</strong>
                  <span>Picker session</span>
                  <small>
                    {session.expireTime ? `Expires ${new Date(session.expireTime).toLocaleString("en-US")}` : "Google controls session expiry."}
                  </small>
                </div>
                <div className="admin-top-card">
                  <strong>{items.length}</strong>
                  <span>Picked items</span>
                  <small>{selectedIds.length} currently selected for import</small>
                </div>
              </div>
            </div>
          ) : null}

          {items.length ? (
            <div className="admin-import-summary">
              <div className="admin-section-heading admin-section-heading--tight">
                <div>
                  <h2>Selection preview</h2>
                  <p>Review the items returned by Google Photos, then keep only the ones you want to ingest.</p>
                </div>
              </div>

              <div className="admin-import-results">
                {items.map((item) => (
                  <label key={item.id} className="admin-import-result">
                    <div className="admin-check">
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelectedItem(item.id)} />
                      <span>{item.filename}</span>
                    </div>
                    <span>
                      {formatPickedType(item)} · {item.mimeType}
                      {item.width && item.height ? ` · ${item.width}x${item.height}` : ""}
                    </span>
                    <small>{item.videoProcessingStatus ? `Video status: ${item.videoProcessingStatus}` : "Ready for import."}</small>
                  </label>
                ))}
              </div>

              <div className="admin-upload-actions">
                <button type="button" onClick={importSelection} disabled={disabled || !selectedIds.length}>
                  {isWorking ? "Importing..." : "Import selected Google Photos media"}
                </button>
                <small>{selectedIds.length} of {items.length} items selected for import.</small>
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="admin-import-summary">
              <div className="admin-top-grid admin-top-grid--import">
                <div className="admin-top-card">
                  <strong>{summary.importedCount || 0}</strong>
                  <span>Imported</span>
                  <small>{summary.selectedCount || 0} picked for this run</small>
                </div>
                <div className="admin-top-card">
                  <strong>{summary.failedCount || 0}</strong>
                  <span>Failed</span>
                  <small>{summary.skippedCount || 0} not selected</small>
                </div>
              </div>

              {summary.details?.length ? (
                <div className="admin-import-results">
                  {summary.details.map((item) => (
                    <article key={`${item.id}-${item.outcome}`} className="admin-import-result">
                      <strong>{item.filename}</strong>
                      <span>{item.outcome}</span>
                      <small>{item.error || item.assetId || "Imported into the media library."}</small>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
