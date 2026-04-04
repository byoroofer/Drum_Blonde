"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function UploadWidget({ uploadEnabled, missingConfig = [] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("drumbrooke, internal-library");
  const [manualRank, setManualRank] = useState("0");
  const [homeSlot, setHomeSlot] = useState("");
  const [featuredHome, setFeaturedHome] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("approved");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const disabled = !uploadEnabled || !files.length || isPending;

  function handleSubmit() {
    if (disabled) {
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    formData.set("source", "upload");
    formData.set("title", title);
    formData.set("description", description);
    formData.set("tags", tags);
    formData.set("manualRank", manualRank);
    formData.set("homeSlot", homeSlot);
    formData.set("featuredHome", String(featuredHome));
    formData.set("workflowStatus", workflowStatus);
    formData.set("active", "true");

    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/upload");
    request.responseType = "json";

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      setProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      const response = request.response || {};
      if (request.status >= 200 && request.status < 300) {
        setStatus(`Uploaded ${response.uploaded || files.length} asset(s).`);
        setFiles([]);
        setProgress(100);
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      setStatus(response.message || "Upload failed.");
    };

    request.onerror = () => {
      setStatus("Upload failed due to a network error.");
    };

    setStatus(`Uploading ${files.length} file(s) to Supabase Storage...`);
    setProgress(0);
    request.send(formData);
  }

  return (
    <section className="admin-upload-card">
      <details className="admin-collapsible admin-collapsible--embedded">
        <summary>
          <div className="admin-collapsible__summary">
            <div>
              <p className="admin-kicker">Upload Panel</p>
              <h2>Upload media</h2>
              <p>Drag in files, upload to Supabase first, and keep the whole ingest path visible.</p>
            </div>
            <span className="admin-collapsible__meta">Collapse</span>
          </div>
        </summary>

        <div className="admin-collapsible__body">
          <div className="admin-section-heading">
            <div>
              <p>
                Files are uploaded to Supabase Storage first, written into Postgres immediately,
                then enriched with metadata and optional filter tags. Nothing is silently blocked.
              </p>
            </div>
            <div className="admin-mini-note">
              <strong>Storage target</strong>
              <span>Bucket `drum-media` stores originals first. Filtering is metadata-only and fully reversible.</span>
            </div>
          </div>

          {!uploadEnabled ? (
            <p className="admin-note">Missing configuration: {missingConfig.join(", ") || "Supabase env vars"}.</p>
          ) : null}

          <label className="admin-field">
            <span>Files</span>
            <input type="file" multiple accept="image/*,video/*" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
          </label>

          {files.length ? (
            <div className="admin-selected-files">
              {files.slice(0, 6).map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
              {files.length > 6 ? <span>+{files.length - 6} more</span> : null}
            </div>
          ) : null}

          <div className="admin-grid admin-grid--compact">
            <label className="admin-field">
              <span>Shared title override</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional shared title" />
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
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Internal notes or media context" />
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
            <span>Feature these uploads on the homepage immediately</span>
          </label>

          <div className="admin-upload-actions">
            <button type="button" onClick={handleSubmit} disabled={disabled}>
              {isPending ? "Refreshing..." : "Upload to Supabase"}
            </button>
            <small>{status || `${files.length} file(s) selected`}</small>
          </div>

          {progress > 0 ? (
            <div className="admin-progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}


