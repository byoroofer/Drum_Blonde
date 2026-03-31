"use client";

import { useEffect, useState } from "react";
import { SectionCard, StatusPill } from "@/components/ui";
import { getDestinationPlatforms } from "@/core/platforms";
import type { GooglePhotosPickedItemSummary, GooglePhotosPickerSessionSummary } from "@/core/types";

const destinations = getDestinationPlatforms();

function formatPolling(ms: number) {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function formatType(item: GooglePhotosPickedItemSummary) {
  if (item.type === "VIDEO") return "Video";
  if (item.type === "PHOTO") return "Photo";
  return "Media";
}

export default function GooglePhotosPickerPanel({
  pickerReady,
  missingEnv,
  connectionDetail,
  requiredScope,
  actionHref,
  actionLabel,
  connected,
  source,
  tone
}: {
  pickerReady: boolean;
  missingEnv: string[];
  connectionDetail: string;
  requiredScope: string;
  actionHref: string | null;
  actionLabel: string | null;
  connected: boolean;
  source: "cookie" | "env" | null;
  tone: "good" | "warn" | "bad";
}) {
  const [maxItemCount, setMaxItemCount] = useState("12");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("google photos, brooke");
  const [campaign, setCampaign] = useState("");
  const [creatorNotes, setCreatorNotes] = useState("");
  const [voicePreset, setVoicePreset] = useState("drummer_girl");
  const [approvalPolicy, setApprovalPolicy] = useState("human_required");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>(
    destinations.filter((item) => item.platform !== "reddit").map((item) => item.platform)
  );
  const [session, setSession] = useState<GooglePhotosPickerSessionSummary | null>(null);
  const [items, setItems] = useState<GooglePhotosPickedItemSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (!session || session.mediaItemsSet) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void pollSession(session.id, false);
    }, session.pollIntervalMs || 3000);

    return () => window.clearTimeout(timeoutId);
  }, [session]);

  function toggleDestination(platform: string) {
    setSelectedDestinations((current) =>
      current.includes(platform) ? current.filter((entry) => entry !== platform) : [...current, platform]
    );
  }

  function toggleSelectedItem(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  async function disconnectGooglePhotos() {
    setIsWorking(true);
    setError("");

    try {
      const response = await fetch("/api/google-photos/oauth/disconnect", { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to disconnect Google Photos.");
      }
      window.location.assign("/admin?tab=library&notice=google-disconnected");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to disconnect Google Photos.");
      setIsWorking(false);
    }
  }

  async function startPicker() {
    setError("");
    setStatus("Creating Google Photos picker session...");
    setIsWorking(true);
    const popup = window.open("", "_blank", "noopener,noreferrer");

    try {
      const response = await fetch("/api/google-photos/picker/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ maxItemCount })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to create Google Photos picker session.");
      }

      const nextSession = payload.session as GooglePhotosPickerSessionSummary;
      setSession(nextSession);
      setItems([]);
      setSelectedIds([]);
      setStatus(`Picker session ready. Complete your selection in Google Photos, then this panel will poll every ${formatPolling(nextSession.pollIntervalMs)}.`);

      const pickerUrl = `${nextSession.pickerUri}/autoclose`;
      if (popup) {
        popup.location.href = pickerUrl;
      } else {
        window.open(pickerUrl, "_blank", "noopener,noreferrer");
      }
    } catch (nextError) {
      popup?.close();
      setError(nextError instanceof Error ? nextError.message : "Unable to start Google Photos Picker.");
      setStatus("");
    } finally {
      setIsWorking(false);
    }
  }

  async function pollSession(sessionId: string, manual = true) {
    if (manual) {
      setIsWorking(true);
      setError("");
    }

    try {
      const response = await fetch(`/api/google-photos/picker/session/${encodeURIComponent(sessionId)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to poll Google Photos picker session.");
      }

      const nextSession = payload.session as GooglePhotosPickerSessionSummary;
      const nextItems = (payload.items || []) as GooglePhotosPickedItemSummary[];
      setSession(nextSession);
      setItems(nextItems);

      if (nextItems.length) {
        setSelectedIds((current) => (current.length ? current.filter((id) => nextItems.some((item) => item.id === id)) : nextItems.map((item) => item.id)));
      }

      setStatus(
        nextSession.mediaItemsSet
          ? `Selection complete. ${nextItems.length} item(s) ready to import.`
          : `Waiting for selection in Google Photos. Polling every ${formatPolling(nextSession.pollIntervalMs)}.`
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to poll Google Photos picker session.");
    } finally {
      if (manual) {
        setIsWorking(false);
      }
    }
  }

  async function importSelection() {
    if (!session) {
      return;
    }

    setIsWorking(true);
    setError("");
    setStatus(`Importing ${selectedIds.length || items.length} Google Photos item(s)...`);

    try {
      const response = await fetch("/api/google-photos/picker/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: session.id,
          selectedIds,
          titlePrefix,
          description,
          tags,
          campaign,
          creatorNotes,
          voicePreset,
          approvalPolicy,
          scheduledFor,
          destinations: selectedDestinations
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to import picked Google Photos media.");
      }

      const result = payload.result as { importedCount: number; skippedCount: number };
      setStatus(`Imported ${result.importedCount} item(s). Skipped ${result.skippedCount}. Refreshing library...`);
      window.location.assign("/admin?tab=library&notice=uploaded");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to import picked Google Photos media.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <SectionCard title="Google Photos picker import" meta="Supported Google flow: choose items in Google Photos, then import them into Supabase storage.">
      {!pickerReady ? (
        <div className={`inline-alert${tone === "bad" ? " inline-alert--error" : ""} picker-status-card`}>
          <strong>Google Photos import is optional and currently unavailable.</strong>
          <p>{connectionDetail}</p>
          {missingEnv.length ? <p>Missing Google setup: {missingEnv.join(", ")}.</p> : null}
          <p>Required scope: <code>{requiredScope}</code>.</p>
          <p>Manual upload below remains available.</p>
          {actionHref && actionLabel ? <a className="primary-button" href={actionHref}>{actionLabel}</a> : null}
        </div>
      ) : (
        <div className="inline-alert picker-status-card">
          <div>
            <strong>Google Photos is connected.</strong>
            <p>{connectionDetail}</p>
          </div>
          <div className="inline-actions">
            {actionHref && actionLabel ? <a className="ghost-button" href={actionHref}>{actionLabel}</a> : null}
            {connected && source === "cookie" ? <button type="button" className="ghost-button" onClick={() => void disconnectGooglePhotos()} disabled={isWorking}>Disconnect</button> : null}
          </div>
        </div>
      )}

      <div className="stack-form">
        <div className="inline-alert">
          This uses Google&apos;s current Picker API, not the legacy library scan. You choose the items in Google Photos, then this admin imports only those selected files.
        </div>

        <div className="form-grid">
          <label><span>Max picks</span><input value={maxItemCount} onChange={(event) => setMaxItemCount(event.target.value)} placeholder="12" /></label>
          <label><span>Title prefix</span><input value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} placeholder="Optional prefix for imported titles" /></label>
          <label><span>Campaign</span><input value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="tour-week, practice-push" /></label>
          <label>
            <span>Voice preset</span>
            <select value={voicePreset} onChange={(event) => setVoicePreset(event.target.value)}>
              <option value="playful">Playful</option>
              <option value="drummer_girl">Drummer girl / music creator</option>
              <option value="confident">Confident</option>
              <option value="flirty_safe">Flirty but safe</option>
              <option value="livestream_growth">Livestream growth</option>
            </select>
          </label>
        </div>

        <label><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Optional caption context applied to all imported items." /></label>
        <div className="form-grid">
          <label><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="google photos, brooke" /></label>
          <label><span>Schedule</span><input value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} type="datetime-local" /></label>
          <label>
            <span>Approval mode</span>
            <select value={approvalPolicy} onChange={(event) => setApprovalPolicy(event.target.value)}>
              <option value="human_required">Human approval required</option>
              <option value="auto_post_approved_only">Auto-post approved-only</option>
            </select>
          </label>
        </div>
        <label><span>Creator notes</span><textarea value={creatorNotes} onChange={(event) => setCreatorNotes(event.target.value)} rows={2} placeholder="Notes for review or scheduling." /></label>

        <fieldset className="checkbox-grid">
          <legend>Destinations</legend>
          {destinations.map((platform) => (
            <label key={platform.platform} className="checkbox-chip">
              <input type="checkbox" checked={selectedDestinations.includes(platform.platform)} onChange={() => toggleDestination(platform.platform)} />
              <span>{platform.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="inline-actions">
          <button type="button" className="primary-button" onClick={startPicker} disabled={!pickerReady || isWorking}>Start Google Photos picker</button>
          {session ? <button type="button" className="ghost-button" onClick={() => void pollSession(session.id)} disabled={isWorking}>Poll selection</button> : null}
          {session?.pickerUri ? <a className="ghost-button" href={`${session.pickerUri}/autoclose`} target="_blank" rel="noreferrer">Open picker again</a> : null}
        </div>

        {status ? <div className="inline-alert">{status}</div> : null}
        {error ? <div className="inline-alert inline-alert--error">{error}</div> : null}

        {session ? (
          <div className="picker-summary">
            <StatusPill tone={session.mediaItemsSet ? "good" : "warn"}>{session.mediaItemsSet ? "Selection ready" : "Waiting for picks"}</StatusPill>
            <span>Session expires {session.expireTime ? new Date(session.expireTime).toLocaleString("en-US") : "soon"}</span>
          </div>
        ) : null}

        {items.length ? (
          <div className="picker-list">
            {items.map((item) => (
              <label key={item.id} className="picker-item">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelectedItem(item.id)} />
                <div>
                  <strong>{item.filename}</strong>
                  <p>{formatType(item)}  |  {item.mimeType}{item.width && item.height ? `  |  ${item.width}x${item.height}` : ""}</p>
                </div>
                {item.videoProcessingStatus ? <StatusPill tone={item.videoProcessingStatus === "READY" ? "good" : "warn"}>{item.videoProcessingStatus.toLowerCase()}</StatusPill> : null}
              </label>
            ))}
          </div>
        ) : null}

        {items.length ? (
          <div className="inline-actions">
            <button type="button" className="primary-button" onClick={importSelection} disabled={isWorking || !selectedIds.length}>Import selected Google Photos media</button>
            <span>{selectedIds.length} of {items.length} selected</span>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
