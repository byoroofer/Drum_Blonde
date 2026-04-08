"use client";

import { useEffect } from "react";

export const IMAGE_PRESETS = [
  { key: "original", label: "Original", ratio: null },
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "Portrait", ratio: 4 / 5 },
  { key: "landscape", label: "Landscape", ratio: 16 / 9 }
];

export const VIDEO_PRESETS = [
  { key: "original", label: "Original", ratio: null },
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "Portrait", ratio: 9 / 16 },
  { key: "landscape", label: "Landscape", ratio: 16 / 9 }
];

export function clamp(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(numeric, min), max);
}

export function formatDuration(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function buildReturnHref(returnTo) {
  return returnTo || "/admin/media";
}

export function buildStageDimensions(ratio, bounds) {
  const maxWidth = Math.max(320, Math.floor(bounds.width || 960));
  const maxHeight = Math.max(360, Math.floor(bounds.height || 640));

  if (!ratio) {
    return {
      width: maxWidth,
      height: Math.min(maxHeight, 560)
    };
  }

  let width = maxWidth;
  let height = Math.round(width / ratio);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }

  return { width, height };
}

export function getCropBox(width, height, presetKey) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const preset = VIDEO_PRESETS.find((entry) => entry.key === presetKey) || VIDEO_PRESETS[0];

  if (!preset.ratio) {
    return { x: 0, y: 0, width: safeWidth, height: safeHeight };
  }

  const sourceRatio = safeWidth / safeHeight;
  if (sourceRatio > preset.ratio) {
    const cropWidth = Math.round(safeHeight * preset.ratio);
    return {
      x: Math.max(0, Math.round((safeWidth - cropWidth) / 2)),
      y: 0,
      width: cropWidth,
      height: safeHeight
    };
  }

  const cropHeight = Math.round(safeWidth / preset.ratio);
  return {
    x: 0,
    y: Math.max(0, Math.round((safeHeight - cropHeight) / 2)),
    width: safeWidth,
    height: cropHeight
  };
}

export function createObjectId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildEditorRedirect(returnTo, mediaId) {
  const fallback = "/admin/media";
  const input = String(returnTo || fallback).trim();
  const url = new URL(input.startsWith("http") ? input : `https://local${input.startsWith("/") ? input : fallback}`);
  url.searchParams.set("save", "edited");
  url.searchParams.set("media", mediaId);
  url.searchParams.delete("reason");
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function blobFromDataUrl(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function useUnsavedChangesGuard(dirty) {
  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      if (window.confirm("Discard unsaved editor changes?")) {
        return;
      }

      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [dirty]);
}

export function EditorHeader({ title, subtitle, dirty, saving, onBack, backHref }) {
  return (
    <div className="media-editor-shell__header">
      <div>
        <p className="admin-kicker">Media Editor</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="media-editor-shell__actions">
        <button type="button" className="admin-ghost-button" onClick={onBack} disabled={saving}>
          Back to library
        </button>
        <a className="admin-ghost-button" href={backHref}>
          Open return target
        </a>
        <span className={`media-editor-shell__status${dirty ? " media-editor-shell__status--dirty" : ""}`}>
          {saving ? "Saving..." : dirty ? "Unsaved changes" : "Saved state"}
        </span>
      </div>
    </div>
  );
}

export function EditorSaveBar({ error, success, saving, saveLabel, onSave }) {
  return (
    <div className="media-editor-shell__savebar">
      <div className="media-editor-shell__messages">
        {error ? <p className="media-editor-shell__error">{error}</p> : null}
        {!error && success ? <p className="media-editor-shell__success">{success}</p> : null}
      </div>
      <button type="button" className="media-editor-shell__savebutton" onClick={onSave} disabled={saving}>
        {saving ? "Saving..." : saveLabel}
      </button>
    </div>
  );
}
