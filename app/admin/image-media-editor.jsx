"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IMAGE_PRESETS,
  EditorHeader,
  EditorSaveBar,
  blobFromDataUrl,
  buildEditorRedirect,
  buildReturnHref,
  buildStageDimensions,
  clamp,
  createObjectId,
  useUnsavedChangesGuard
} from "@/app/admin/media-editor-shell";

export default function ImageMediaEditor({ item, returnTo }) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const canvasInstanceRef = useRef(null);
  const baseImageRef = useRef(null);
  const containerRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const restoringRef = useRef(false);
  const fabricRef = useRef(null);
  const [stageBounds, setStageBounds] = useState({ width: 900, height: 640 });
  const [aspectPreset, setAspectPreset] = useState("original");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [canvasReady, setCanvasReady] = useState(false);

  useUnsavedChangesGuard(dirty);

  const selectedPreset = IMAGE_PRESETS.find((entry) => entry.key === aspectPreset) || IMAGE_PRESETS[0];
  const stageDimensions = useMemo(
    () => buildStageDimensions(selectedPreset.ratio, stageBounds),
    [selectedPreset.ratio, stageBounds]
  );
  const editorSourceUrl = `/api/admin/media/${item.id}/source`;
  const outputMimeType = String(item.mimeType || "").includes("png") ? "image/png" : "image/jpeg";
  const outputExtension = outputMimeType === "image/png" ? ".png" : ".jpg";

  useEffect(() => {
    function updateBounds() {
      const node = containerRef.current;
      if (!node) {
        return;
      }

      const width = Math.max(320, Math.floor(node.clientWidth - 2));
      const height = Math.max(420, Math.floor(window.innerHeight * 0.66));
      setStageBounds({ width, height });
    }

    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setupCanvas() {
      const fabricModule = await import("fabric");
      if (cancelled || !canvasRef.current) {
        return;
      }

      fabricRef.current = fabricModule;

      if (!canvasInstanceRef.current) {
        const canvas = new fabricModule.Canvas(canvasRef.current, {
          preserveObjectStacking: true,
          selection: true,
          backgroundColor: "#060914"
        });

        const recordHistory = () => {
          if (restoringRef.current) {
            return;
          }

          historyRef.current.push(JSON.stringify(canvas.toJSON(["dataRole", "editorId"])));
          if (historyRef.current.length > 24) {
            historyRef.current.shift();
          }
          redoRef.current = [];
        };

        canvas.on("object:added", recordHistory);
        canvas.on("object:modified", recordHistory);
        canvas.on("object:removed", recordHistory);
        canvasInstanceRef.current = canvas;
      }

      const canvas = canvasInstanceRef.current;
      canvas.setDimensions(stageDimensions);

      if (!baseImageRef.current) {
        const image = await fabricModule.FabricImage.fromURL(editorSourceUrl, {
          crossOrigin: "anonymous"
        });

        if (cancelled) {
          return;
        }

        image.set({
          selectable: false,
          evented: false,
          dataRole: "base-image",
          editorId: createObjectId("base")
        });
        canvas.add(image);
        image.sendToBack();
        baseImageRef.current = image;
        historyRef.current = [JSON.stringify(canvas.toJSON(["dataRole", "editorId"]))];
      }

      setCanvasReady(true);
    }

    setupCanvas().catch((error) => {
      setSaveError(error instanceof Error ? error.message : "Image editor failed to load.");
    });

    return () => {
      cancelled = true;
    };
  }, [editorSourceUrl, stageDimensions]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    const baseImage = baseImageRef.current;
    const fabricModule = fabricRef.current;
    if (!canvas || !baseImage || !fabricModule) {
      return;
    }

    canvas.setDimensions(stageDimensions);

    const baseScale = Math.max(
      stageDimensions.width / Math.max(1, baseImage.width || 1),
      stageDimensions.height / Math.max(1, baseImage.height || 1)
    );

    baseImage.set({
      originX: "center",
      originY: "center",
      left: stageDimensions.width / 2 + panX,
      top: stageDimensions.height / 2 + panY,
      angle: rotation,
      flipX,
      flipY,
      scaleX: baseScale * zoom,
      scaleY: baseScale * zoom
    });

    const nextFilters = [];
    if (Math.abs(brightness) > 0.001 && fabricModule.filters?.Brightness) {
      nextFilters.push(new fabricModule.filters.Brightness({ brightness }));
    }
    if (Math.abs(contrast) > 0.001 && fabricModule.filters?.Contrast) {
      nextFilters.push(new fabricModule.filters.Contrast({ contrast }));
    }
    if (Math.abs(saturation) > 0.001 && fabricModule.filters?.Saturation) {
      nextFilters.push(new fabricModule.filters.Saturation({ saturation }));
    }

    baseImage.filters = nextFilters;
    baseImage.applyFilters();
    baseImage.setCoords();
    canvas.renderAll();
  }, [brightness, contrast, flipX, flipY, panX, panY, rotation, saturation, stageDimensions, zoom]);

  useEffect(() => {
    return () => {
      canvasInstanceRef.current?.dispose();
      canvasInstanceRef.current = null;
      baseImageRef.current = null;
    };
  }, []);

  async function restoreSnapshot(targetStack, destinationStack) {
    const canvas = canvasInstanceRef.current;
    if (!canvas) {
      return;
    }

    const current = JSON.stringify(canvas.toJSON(["dataRole", "editorId"]));
    destinationStack.current.push(current);
    const nextSnapshot = targetStack.current.pop();
    if (!nextSnapshot) {
      return;
    }

    restoringRef.current = true;
    await canvas.loadFromJSON(nextSnapshot);
    restoringRef.current = false;
    baseImageRef.current = canvas.getObjects().find((entry) => entry.dataRole === "base-image") || null;
    canvas.renderAll();
    setDirty(true);
  }

  function addText() {
    const canvas = canvasInstanceRef.current;
    const fabricModule = fabricRef.current;
    if (!canvas || !fabricModule) {
      return;
    }

    const textbox = new fabricModule.Textbox("Brooke", {
      left: stageDimensions.width / 2,
      top: stageDimensions.height * 0.15,
      originX: "center",
      fontSize: 42,
      fontWeight: 700,
      fill: "#ffffff",
      stroke: "rgba(0,0,0,0.42)",
      strokeWidth: 1.2,
      cornerStyle: "circle",
      transparentCorners: false,
      editorId: createObjectId("text")
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
    setDirty(true);
  }

  function addShape(shapeType) {
    const canvas = canvasInstanceRef.current;
    const fabricModule = fabricRef.current;
    if (!canvas || !fabricModule) {
      return;
    }

    const shared = {
      left: stageDimensions.width / 2,
      top: stageDimensions.height / 2,
      originX: "center",
      originY: "center",
      fill: "rgba(255,255,255,0.18)",
      stroke: "#ffffff",
      strokeWidth: 2,
      editorId: createObjectId(shapeType)
    };

    const shape = shapeType === "circle"
      ? new fabricModule.Circle({ ...shared, radius: 80 })
      : new fabricModule.Rect({ ...shared, width: 180, height: 120, rx: 18, ry: 18 });

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
    setDirty(true);
  }

  function handleBack() {
    if (dirty && !window.confirm("Discard unsaved editor changes?")) {
      return;
    }

    router.push(buildReturnHref(returnTo));
  }

  async function saveImage() {
    const canvas = canvasInstanceRef.current;
    if (!canvas) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const format = outputMimeType === "image/png" ? "png" : "jpeg";
      const dataUrl = canvas.toDataURL({
        format,
        quality: 0.92,
        multiplier: 1
      });
      const blob = await blobFromDataUrl(dataUrl);
      const formData = new FormData();
      formData.append("file", new File([blob], `${(item.title || "asset").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-edited${outputExtension}`, { type: outputMimeType }));
      formData.append("editType", "image");
      formData.append("returnTo", buildReturnHref(returnTo));
      formData.append("editPayload", JSON.stringify({
        cropPreset: aspectPreset,
        zoom,
        panX,
        panY,
        rotation,
        flipX,
        flipY,
        brightness,
        contrast,
        saturation
      }));
      formData.append("width", String(stageDimensions.width));
      formData.append("height", String(stageDimensions.height));

      const response = await fetch(`/api/admin/media/${item.id}/edits`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Save failed.");
      }

      setDirty(false);
      setSaveSuccess("Edited image saved as a derived asset.");
      router.push(payload.redirectTo || buildEditorRedirect(returnTo, payload.asset?.id));
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Image save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="media-editor-shell">
      <EditorHeader
        title={item.title || "Image editor"}
        subtitle="Crop, rotate, adjust, annotate, and save a derived image without touching the original."
        dirty={dirty}
        saving={saving}
        onBack={handleBack}
        backHref={buildReturnHref(returnTo)}
      />

      <div className="media-editor-shell__layout">
        <aside className="media-editor-shell__toolbar">
          <section className="media-editor-shell__panel">
            <h2>Canvas</h2>
            <div className="media-editor-shell__chip-row">
              {IMAGE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`media-editor-shell__chip${aspectPreset === preset.key ? " media-editor-shell__chip--active" : ""}`}
                  onClick={() => {
                    setAspectPreset(preset.key);
                    setDirty(true);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section className="media-editor-shell__panel">
            <h2>Transform</h2>
            <label className="admin-field">
              <span>Zoom</span>
              <input type="range" min="1" max="2.6" step="0.05" value={zoom} onChange={(event) => { setZoom(clamp(event.target.value, 1, 2.6, 1)); setDirty(true); }} />
            </label>
            <label className="admin-field">
              <span>Pan X</span>
              <input type="range" min="-220" max="220" step="1" value={panX} onChange={(event) => { setPanX(clamp(event.target.value, -220, 220, 0)); setDirty(true); }} />
            </label>
            <label className="admin-field">
              <span>Pan Y</span>
              <input type="range" min="-220" max="220" step="1" value={panY} onChange={(event) => { setPanY(clamp(event.target.value, -220, 220, 0)); setDirty(true); }} />
            </label>
            <label className="admin-field">
              <span>Rotate</span>
              <select value={rotation} onChange={(event) => { setRotation(clamp(event.target.value, 0, 270, 0)); setDirty(true); }}>
                <option value="0">0 deg</option>
                <option value="90">90 deg</option>
                <option value="180">180 deg</option>
                <option value="270">270 deg</option>
              </select>
            </label>
            <div className="media-editor-shell__button-row">
              <button type="button" className="admin-ghost-button" onClick={() => { setFlipX((value) => !value); setDirty(true); }}>
                Flip X
              </button>
              <button type="button" className="admin-ghost-button" onClick={() => { setFlipY((value) => !value); setDirty(true); }}>
                Flip Y
              </button>
            </div>
          </section>

          <section className="media-editor-shell__panel">
            <h2>Adjust</h2>
            <label className="admin-field">
              <span>Brightness</span>
              <input type="range" min="-0.7" max="0.7" step="0.05" value={brightness} onChange={(event) => { setBrightness(clamp(event.target.value, -0.7, 0.7, 0)); setDirty(true); }} />
            </label>
            <label className="admin-field">
              <span>Contrast</span>
              <input type="range" min="-0.7" max="0.7" step="0.05" value={contrast} onChange={(event) => { setContrast(clamp(event.target.value, -0.7, 0.7, 0)); setDirty(true); }} />
            </label>
            <label className="admin-field">
              <span>Saturation</span>
              <input type="range" min="-0.9" max="0.9" step="0.05" value={saturation} onChange={(event) => { setSaturation(clamp(event.target.value, -0.9, 0.9, 0)); setDirty(true); }} />
            </label>
          </section>

          <section className="media-editor-shell__panel">
            <h2>Layers</h2>
            <div className="media-editor-shell__button-row">
              <button type="button" className="admin-ghost-button" onClick={addText}>Add text</button>
              <button type="button" className="admin-ghost-button" onClick={() => addShape("rect")}>Rectangle</button>
              <button type="button" className="admin-ghost-button" onClick={() => addShape("circle")}>Circle</button>
            </div>
            <div className="media-editor-shell__button-row">
              <button type="button" className="admin-ghost-button" onClick={() => restoreSnapshot(historyRef, redoRef)} disabled={historyRef.current.length <= 1}>
                Undo
              </button>
              <button type="button" className="admin-ghost-button" onClick={() => restoreSnapshot(redoRef, historyRef)} disabled={!redoRef.current.length}>
                Redo
              </button>
            </div>
          </section>
        </aside>

        <section className="media-editor-shell__stage" ref={containerRef}>
          <div className="media-editor-shell__stage-card">
            {!canvasReady ? <p className="admin-note">Loading image editor...</p> : null}
            <canvas ref={canvasRef} />
          </div>
        </section>
      </div>

      <EditorSaveBar
        error={saveError}
        success={saveSuccess}
        saving={saving}
        saveLabel="Save derived image"
        onSave={saveImage}
      />
    </div>
  );
}
