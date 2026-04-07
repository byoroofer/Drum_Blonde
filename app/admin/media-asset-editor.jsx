"use client";

import { useMemo, useState } from "react";
import ClipRangeEditor from "@/app/admin/clip-range-editor";
import TrackableVideo from "@/app/components/trackable-video";

function clampValue(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(numeric, min), max);
}

function formatFactor(value) {
  return Number(value || 1).toFixed(2).replace(/\.00$/, "");
}

function buildImageFilter({ brightness, contrast, saturation }) {
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
}

function VideoEditor({ item, posterSrc }) {
  const [muteOutput, setMuteOutput] = useState(false);

  return (
    <div className="media-asset-editor">
      <div className="media-asset-editor__preview">
        <TrackableVideo
          src={item.url}
          playbackUrl={item.playbackUrl}
          poster={posterSrc}
          title={item.title}
          controls
          muted={muteOutput}
          clipStartSeconds={0}
          clipEndSeconds={item.durationSeconds}
        />
      </div>

      <div className="media-asset-editor__panel">
        <div className="media-asset-editor__copy">
          <strong>High-quality video editor</strong>
          <p>Trim the source clip and optionally remove audio. Saving creates a freshly processed MP4 optimized for clean playback.</p>
        </div>

        <ClipRangeEditor
          durationSeconds={item.durationSeconds}
          defaultStartSeconds={0}
          defaultEndSeconds={item.durationSeconds}
          startInputName="editTrimStartSeconds"
          endInputName="editTrimEndSeconds"
          startLabel="Trim start"
          endLabel="Trim end"
          clipSummaryLabel="saved clip"
          resetLabel="Keep full video"
        />

        <label className="admin-check">
          <input
            name="editMuteAudio"
            type="checkbox"
            checked={muteOutput}
            onChange={(event) => setMuteOutput(event.target.checked)}
          />
          <span>Remove audio in saved file</span>
        </label>
      </div>
    </div>
  );
}

function ImageEditor({ item, posterSrc }) {
  const [rotateDegrees, setRotateDegrees] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);

  const imageFilter = useMemo(
    () => buildImageFilter({ brightness, contrast, saturation }),
    [brightness, contrast, saturation]
  );

  return (
    <div className="media-asset-editor">
      <input type="hidden" name="imageRotateDegrees" value={rotateDegrees} />
      <input type="hidden" name="imageBrightness" value={brightness} />
      <input type="hidden" name="imageContrast" value={contrast} />
      <input type="hidden" name="imageSaturation" value={saturation} />

      <div className="media-asset-editor__preview media-asset-editor__preview--image">
        <img
          className="media-asset-editor__image"
          src={posterSrc}
          alt={item.title || ""}
          style={{
            transform: `rotate(${rotateDegrees}deg)`,
            filter: imageFilter
          }}
        />
      </div>

      <div className="media-asset-editor__panel">
        <div className="media-asset-editor__copy">
          <strong>High-quality photo editor</strong>
          <p>Rotate and adjust brightness, contrast, and saturation. Saving writes a new processed asset back to the library.</p>
        </div>

        <label className="admin-field">
          <span>Rotation</span>
          <select value={rotateDegrees} onChange={(event) => setRotateDegrees(clampValue(event.target.value, 0, 270, 0))}>
            <option value="0">0 deg</option>
            <option value="90">90 deg</option>
            <option value="180">180 deg</option>
            <option value="270">270 deg</option>
          </select>
        </label>

        <label className="admin-field clip-range-editor__field">
          <span>Brightness</span>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={brightness}
            onChange={(event) => setBrightness(clampValue(event.target.value, 0.5, 1.5, 1))}
          />
          <input
            type="number"
            min="0.5"
            max="1.5"
            step="0.05"
            value={brightness}
            onChange={(event) => setBrightness(clampValue(event.target.value, 0.5, 1.5, 1))}
          />
        </label>

        <label className="admin-field clip-range-editor__field">
          <span>Contrast</span>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.05"
            value={contrast}
            onChange={(event) => setContrast(clampValue(event.target.value, 0.5, 1.8, 1))}
          />
          <input
            type="number"
            min="0.5"
            max="1.8"
            step="0.05"
            value={contrast}
            onChange={(event) => setContrast(clampValue(event.target.value, 0.5, 1.8, 1))}
          />
        </label>

        <label className="admin-field clip-range-editor__field">
          <span>Saturation</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={saturation}
            onChange={(event) => setSaturation(clampValue(event.target.value, 0, 2, 1))}
          />
          <input
            type="number"
            min="0"
            max="2"
            step="0.05"
            value={saturation}
            onChange={(event) => setSaturation(clampValue(event.target.value, 0, 2, 1))}
          />
        </label>

        <div className="media-asset-editor__stats">
          <span>Brightness {formatFactor(brightness)}x</span>
          <span>Contrast {formatFactor(contrast)}x</span>
          <span>Saturation {formatFactor(saturation)}x</span>
        </div>
      </div>
    </div>
  );
}

export default function MediaAssetEditor({ item, posterSrc }) {
  if (!item) {
    return null;
  }

  if (item.kind === "video") {
    return <VideoEditor item={item} posterSrc={posterSrc} />;
  }

  return <ImageEditor item={item} posterSrc={posterSrc} />;
}
