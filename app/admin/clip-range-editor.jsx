"use client";

import { useMemo, useState } from "react";

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(Math.max(numeric, min), max);
}

function formatSeconds(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default function ClipRangeEditor({
  durationSeconds,
  defaultStartSeconds = 0,
  defaultEndSeconds = null,
  startInputName = "clipStartSeconds",
  endInputName = "clipEndSeconds",
  startLabel = "Clip start",
  endLabel = "Clip end",
  clipSummaryLabel = "featured clip",
  resetLabel = "Use full clip"
}) {
  const maxDuration = Math.max(1, Math.round(Number(durationSeconds) || 0));
  const initialStart = clamp(defaultStartSeconds, 0, Math.max(0, maxDuration - 1));
  const initialEnd = clamp(defaultEndSeconds ?? maxDuration, Math.max(initialStart + 1, 1), maxDuration);
  const [startSeconds, setStartSeconds] = useState(initialStart);
  const [endSeconds, setEndSeconds] = useState(initialEnd);
  const clipLength = useMemo(() => Math.max(1, endSeconds - startSeconds), [endSeconds, startSeconds]);

  function updateStart(nextValue) {
    const nextStart = clamp(nextValue, 0, Math.max(0, endSeconds - 1));
    setStartSeconds(nextStart);
  }

  function updateEnd(nextValue) {
    const nextEnd = clamp(nextValue, Math.max(startSeconds + 1, 1), maxDuration);
    setEndSeconds(nextEnd);
  }

  function resetClip() {
    setStartSeconds(0);
    setEndSeconds(maxDuration);
  }

  return (
    <div className="clip-range-editor">
      <input type="hidden" name={startInputName} value={startSeconds} />
      <input type="hidden" name={endInputName} value={endSeconds} />

      <div className="clip-range-editor__summary">
        <strong>{formatSeconds(startSeconds)} to {formatSeconds(endSeconds)}</strong>
        <span>{clipLength}s {clipSummaryLabel}</span>
      </div>

      <label className="admin-field clip-range-editor__field">
        <span>{startLabel}</span>
        <input
          type="range"
          min="0"
          max={Math.max(0, endSeconds - 1)}
          step="1"
          value={startSeconds}
          onChange={(event) => updateStart(event.target.value)}
        />
        <input
          type="number"
          min="0"
          max={Math.max(0, endSeconds - 1)}
          step="1"
          value={startSeconds}
          onChange={(event) => updateStart(event.target.value)}
        />
      </label>

      <label className="admin-field clip-range-editor__field">
        <span>{endLabel}</span>
        <input
          type="range"
          min={Math.max(startSeconds + 1, 1)}
          max={maxDuration}
          step="1"
          value={endSeconds}
          onChange={(event) => updateEnd(event.target.value)}
        />
        <input
          type="number"
          min={Math.max(startSeconds + 1, 1)}
          max={maxDuration}
          step="1"
          value={endSeconds}
          onChange={(event) => updateEnd(event.target.value)}
        />
      </label>

      <div className="clip-range-editor__footer">
        <span>Full length: {formatSeconds(maxDuration)}</span>
        <button type="button" className="admin-ghost-button" onClick={resetClip}>{resetLabel}</button>
      </div>
    </div>
  );
}
