"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VIDEO_PRESETS,
  EditorHeader,
  EditorSaveBar,
  buildEditorRedirect,
  buildReturnHref,
  clamp,
  formatDuration,
  getCropBox,
  useUnsavedChangesGuard
} from "@/app/admin/media-editor-shell";

export default function VideoMediaEditor({ item, returnTo }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const ffmpegRef = useRef(null);
  const fetchFileRef = useRef(null);
  const ffmpegLoadedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(item.durationSeconds || 0);
  const [coverTime, setCoverTime] = useState(Math.min(1, item.durationSeconds || 0));
  const [cropPreset, setCropPreset] = useState("portrait");
  const [muted, setMuted] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [overlayPosition, setOverlayPosition] = useState("bottom");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [progress, setProgress] = useState(0);

  useUnsavedChangesGuard(dirty);

  const safeDuration = Math.max(1, Number(item.durationSeconds) || 1);
  const exportLimitHit = safeDuration > 90 || Number(item.byteSize || 0) > 180 * 1024 * 1024;
  const cropRatio = (VIDEO_PRESETS.find((entry) => entry.key === cropPreset) || VIDEO_PRESETS[0]).ratio;
  const cropBox = getCropBox(item.width, item.height, cropPreset);
  const previewUrl = item.playbackUrl || `/api/admin/media/${item.id}/source`;

  useEffect(() => {
    setTrimEnd(safeDuration);
    setCoverTime(Math.min(1, safeDuration));
  }, [safeDuration]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) {
      return undefined;
    }

    const handleTimeUpdate = () => {
      setCurrentTime(node.currentTime);
      if (node.currentTime >= trimEnd) {
        node.pause();
        node.currentTime = trimStart;
        setIsPlaying(false);
      }
    };

    const handleLoadedMetadata = () => {
      node.currentTime = trimStart;
    };

    node.addEventListener("timeupdate", handleTimeUpdate);
    node.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      node.removeEventListener("timeupdate", handleTimeUpdate);
      node.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [trimEnd, trimStart]);

  async function ensureVideoAtTime(target) {
    const node = videoRef.current;
    if (!node) {
      throw new Error("Video preview is unavailable.");
    }

    await new Promise((resolve) => {
      const handleSeeked = () => {
        node.removeEventListener("seeked", handleSeeked);
        resolve();
      };

      node.addEventListener("seeked", handleSeeked);
      node.currentTime = clamp(target, 0, safeDuration, 0);
    });
  }

  async function captureCoverBlob() {
    const node = videoRef.current;
    if (!node) {
      return null;
    }

    const wasPaused = node.paused;
    node.pause();
    await ensureVideoAtTime(coverTime);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, cropBox.width);
    canvas.height = Math.max(1, cropBox.height);
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(
      node,
      cropBox.x,
      cropBox.y,
      cropBox.width,
      cropBox.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!wasPaused) {
      node.play().catch(() => {});
      setIsPlaying(true);
    }
    return blob;
  }

  async function getFfmpeg() {
    if (ffmpegRef.current && ffmpegLoadedRef.current && fetchFileRef.current) {
      return {
        ffmpeg: ffmpegRef.current,
        fetchFile: fetchFileRef.current
      };
    }

    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util")
    ]);

    const ffmpeg = ffmpegRef.current || new FFmpeg();
    ffmpegRef.current = ffmpeg;
    fetchFileRef.current = fetchFile;

    if (!ffmpegLoadedRef.current) {
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
      ffmpeg.on("progress", ({ progress: nextProgress }) => {
        setProgress(nextProgress || 0);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
      });
      ffmpegLoadedRef.current = true;
    }

    return {
      ffmpeg,
      fetchFile
    };
  }

  function handleBack() {
    if (dirty && !window.confirm("Discard unsaved editor changes?")) {
      return;
    }

    router.push(buildReturnHref(returnTo));
  }

  async function saveVideo() {
    if (exportLimitHit) {
      setSaveError("This v1 browser export is limited to short clips under 90 seconds and roughly 180 MB.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    setProgress(0);

    try {
      const { ffmpeg, fetchFile } = await getFfmpeg();
      const sourceResponse = await fetch(`/api/admin/media/${item.id}/source`, { cache: "no-store" });
      if (!sourceResponse.ok) {
        throw new Error("Unable to fetch the source video for export.");
      }

      const sourceBlob = await sourceResponse.blob();
      const inputName = "input.mp4";
      const outputName = "output.mp4";
      await ffmpeg.writeFile(inputName, await fetchFile(sourceBlob));

      const args = ["-y"];
      if (trimStart > 0) {
        args.push("-ss", String(trimStart));
      }

      args.push("-i", inputName);
      const exportDuration = Math.max(0.2, trimEnd - trimStart);
      args.push("-t", String(exportDuration));

      const filters = [];
      if (cropPreset !== "original" && item.width && item.height) {
        filters.push(`crop=${cropBox.width}:${cropBox.height}:${cropBox.x}:${cropBox.y}`);
      }

      if (filters.length) {
        args.push("-vf", filters.join(","));
      }

      args.push(
        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart"
      );

      if (muted) {
        args.push("-an");
      } else {
        args.push("-map", "0:a?", "-c:a", "aac", "-b:a", "128k");
      }

      args.push(outputName);
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputName);
      const outputBlob = new Blob([data.buffer], { type: "video/mp4" });
      const coverBlob = await captureCoverBlob();

      const formData = new FormData();
      formData.append("file", new File([outputBlob], `${(item.title || "clip").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-edited.mp4`, { type: "video/mp4" }));
      if (coverBlob) {
        formData.append("coverFile", new File([coverBlob], `${(item.title || "clip").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-cover.jpg`, { type: "image/jpeg" }));
      }
      formData.append("editType", "video");
      formData.append("returnTo", buildReturnHref(returnTo));
      formData.append("coverTimeSeconds", String(coverTime));
      formData.append("width", String(cropBox.width || item.width || ""));
      formData.append("height", String(cropBox.height || item.height || ""));
      formData.append("durationMs", String(Math.round(exportDuration * 1000)));
      formData.append("editPayload", JSON.stringify({
        trimStart,
        trimEnd,
        coverTime,
        cropPreset,
        muted,
        overlayText,
        overlayPosition
      }));

      const response = await fetch(`/api/admin/media/${item.id}/edits`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Save failed.");
      }

      setDirty(false);
      setSaveSuccess("Edited video saved as a derived asset.");
      router.push(payload.redirectTo || buildEditorRedirect(returnTo, payload.asset?.id));
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Video save failed.");
    } finally {
      setSaving(false);
      setProgress(0);
    }
  }

  return (
    <div className="media-editor-shell">
      <EditorHeader
        title={item.title || "Video editor"}
        subtitle="Trim, crop, mute, pick a cover frame, and export a new derived video for the library."
        dirty={dirty}
        saving={saving}
        onBack={handleBack}
        backHref={buildReturnHref(returnTo)}
      />

      <div className="media-editor-shell__layout media-editor-shell__layout--video">
        <section className="media-editor-shell__stage">
          <div className="media-editor-shell__stage-card media-editor-shell__stage-card--video">
            <div className="media-editor-shell__video-frame" style={{ aspectRatio: cropRatio ? String(cropRatio) : "16 / 9" }}>
              <video
                ref={videoRef}
                src={previewUrl}
                poster={item.coverThumbnailUrl || item.posterUrl || item.thumbnailUrl || ""}
                controls={false}
                playsInline
                muted={muted}
                preload="metadata"
              />
              {overlayText ? (
                <div className={`media-editor-shell__video-overlay-text media-editor-shell__video-overlay-text--${overlayPosition}`}>
                  {overlayText}
                </div>
              ) : null}
            </div>
          </div>

          <div className="media-editor-shell__timeline">
            <div className="media-editor-shell__timeline-bar">
              <button
                type="button"
                className="admin-ghost-button"
                onClick={() => {
                  const node = videoRef.current;
                  if (!node) {
                    return;
                  }

                  if (node.paused) {
                    if (node.currentTime >= trimEnd) {
                      node.currentTime = trimStart;
                    }
                    node.play().then(() => setIsPlaying(true)).catch(() => {});
                    return;
                  }

                  node.pause();
                  setIsPlaying(false);
                }}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <span>{formatDuration(currentTime)} / {formatDuration(safeDuration)}</span>
              {progress > 0 ? <span>Export {Math.round(progress * 100)}%</span> : null}
            </div>

            <label className="admin-field">
              <span>Scrub preview</span>
              <input
                type="range"
                min="0"
                max={safeDuration}
                step="0.1"
                value={clamp(currentTime, 0, safeDuration, 0)}
                onChange={(event) => {
                  const next = clamp(event.target.value, 0, safeDuration, 0);
                  const node = videoRef.current;
                  if (!node) {
                    return;
                  }

                  node.currentTime = next;
                  setCurrentTime(next);
                }}
              />
            </label>

            <div className="media-editor-shell__trim-grid">
              <label className="admin-field">
                <span>Trim start</span>
                <input
                  type="range"
                  min="0"
                  max={trimEnd - 0.2}
                  step="0.1"
                  value={trimStart}
                  onChange={(event) => {
                    const next = clamp(event.target.value, 0, Math.max(0, trimEnd - 0.2), 0);
                    setTrimStart(next);
                    setDirty(true);
                  }}
                />
                <small>{formatDuration(trimStart)}</small>
              </label>
              <label className="admin-field">
                <span>Trim end</span>
                <input
                  type="range"
                  min={trimStart + 0.2}
                  max={safeDuration}
                  step="0.1"
                  value={trimEnd}
                  onChange={(event) => {
                    const next = clamp(event.target.value, trimStart + 0.2, safeDuration, safeDuration);
                    setTrimEnd(next);
                    setDirty(true);
                  }}
                />
                <small>{formatDuration(trimEnd)}</small>
              </label>
            </div>
          </div>
        </section>

        <aside className="media-editor-shell__toolbar">
          <section className="media-editor-shell__panel">
            <h2>Crop</h2>
            <div className="media-editor-shell__chip-row">
              {VIDEO_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`media-editor-shell__chip${cropPreset === preset.key ? " media-editor-shell__chip--active" : ""}`}
                  onClick={() => {
                    setCropPreset(preset.key);
                    setDirty(true);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section className="media-editor-shell__panel">
            <h2>Audio</h2>
            <label className="admin-check">
              <input type="checkbox" checked={muted} onChange={(event) => { setMuted(event.target.checked); setDirty(true); }} />
              <span>Mute exported clip</span>
            </label>
          </section>

          <section className="media-editor-shell__panel">
            <h2>Cover</h2>
            <label className="admin-field">
              <span>Cover frame</span>
              <input
                type="range"
                min={trimStart}
                max={trimEnd}
                step="0.1"
                value={coverTime}
                onChange={(event) => {
                  setCoverTime(clamp(event.target.value, trimStart, trimEnd, trimStart));
                  setDirty(true);
                }}
              />
              <small>{formatDuration(coverTime)}</small>
            </label>
          </section>

          <section className="media-editor-shell__panel">
            <h2>Text Overlay</h2>
            <p className="admin-note">Preview layer architecture for future caption export support.</p>
            <label className="admin-field">
              <span>Text</span>
              <input value={overlayText} onChange={(event) => { setOverlayText(event.target.value); setDirty(true); }} placeholder="Add headline text" />
            </label>
            <label className="admin-field">
              <span>Position</span>
              <select value={overlayPosition} onChange={(event) => { setOverlayPosition(event.target.value); setDirty(true); }}>
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
          </section>

          {exportLimitHit ? (
            <section className="media-editor-shell__panel media-editor-shell__panel--warning">
              <h2>Browser Export Limit</h2>
              <p>This video is above the current short-clip browser limit. Trim a shorter version or move the export server-side later.</p>
            </section>
          ) : null}
        </aside>
      </div>

      <EditorSaveBar
        error={saveError}
        success={saveSuccess}
        saving={saving}
        saveLabel="Save derived video"
        onSave={saveVideo}
      />
    </div>
  );
}
