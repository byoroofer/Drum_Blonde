"use client";

import { useEffect, useRef, useState } from "react";

function appendSeekCandidate(candidates, value, maxSeconds) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return;
  }

  const boundedMax = Number.isFinite(maxSeconds) ? Math.max(0.12, maxSeconds) : null;
  const clamped = boundedMax == null ? numeric : Math.min(Math.max(0.12, numeric), boundedMax);
  if (candidates.some((entry) => Math.abs(entry - clamped) < 0.08)) {
    return;
  }

  candidates.push(Number(clamped.toFixed(2)));
}

function buildSeekCandidates(durationSeconds) {
  const duration = Number(durationSeconds);
  const safeEnd = Number.isFinite(duration) && duration > 0 ? Math.max(0.12, duration - 0.12) : null;
  const candidates = [];

  if (safeEnd != null) {
    appendSeekCandidate(candidates, Math.min(Math.max(duration * 0.18, 0.45), 3.2), safeEnd);
    appendSeekCandidate(candidates, Math.min(Math.max(duration * 0.12, 0.3), 2.2), safeEnd);
    appendSeekCandidate(candidates, 1.6, safeEnd);
    appendSeekCandidate(candidates, 0.8, safeEnd);
    appendSeekCandidate(candidates, 2.6, safeEnd);
    appendSeekCandidate(candidates, 0.15, safeEnd);
  } else {
    appendSeekCandidate(candidates, 1.6, null);
    appendSeekCandidate(candidates, 0.8, null);
    appendSeekCandidate(candidates, 2.6, null);
    appendSeekCandidate(candidates, 0.15, null);
  }

  return candidates.length ? candidates : [0.15];
}

function buildCacheBustedUrl(url, seed) {
  if (!url) {
    return "";
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(seed || Date.now()))}`;
}

export default function MediaThumbnail({
  className,
  alt,
  kind,
  storedThumbnailSrc,
  fallbackImageSrc,
  videoSrc,
  durationSeconds,
  thumbnailBackfillUrl,
  cacheKey
}) {
  const hasAttemptedSeekRef = useRef(false);
  const [resolvedImageSrc, setResolvedImageSrc] = useState(
    storedThumbnailSrc || buildCacheBustedUrl(thumbnailBackfillUrl, cacheKey) || fallbackImageSrc || ""
  );
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    hasAttemptedSeekRef.current = false;
    setResolvedImageSrc(storedThumbnailSrc || buildCacheBustedUrl(thumbnailBackfillUrl, cacheKey) || fallbackImageSrc || "");
    setVideoReady(false);
    setVideoFailed(false);
  }, [cacheKey, fallbackImageSrc, storedThumbnailSrc, thumbnailBackfillUrl]);

  if (kind !== "video") {
    return <img className={className} src={storedThumbnailSrc || fallbackImageSrc} alt={alt} loading="lazy" decoding="async" />;
  }

  const previewFallback = resolvedImageSrc || fallbackImageSrc || "";
  const shouldShowVideo = !videoFailed && Boolean(videoSrc);

  return (
    <div className={`${className} media-thumbnail${shouldShowVideo ? " media-thumbnail--video" : ""}${videoReady ? " media-thumbnail--ready" : ""}`}>
      {previewFallback ? <img className="media-thumbnail__image" src={previewFallback} alt={alt} loading="lazy" decoding="async" /> : null}

      {shouldShowVideo ? (
        <video
          className="media-thumbnail__video"
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          aria-label={alt}
          onLoadedData={(event) => {
            const video = event.currentTarget;
            if (hasAttemptedSeekRef.current) {
              return;
            }

            hasAttemptedSeekRef.current = true;
            const candidates = buildSeekCandidates(video.duration || durationSeconds);
            video.currentTime = candidates[0] || 0.15;
          }}
          onSeeked={(event) => {
            event.currentTarget.pause();
            setVideoReady(true);
          }}
          onCanPlay={(event) => {
            const video = event.currentTarget;
            if (hasAttemptedSeekRef.current) {
              return;
            }

            hasAttemptedSeekRef.current = true;
            const candidates = buildSeekCandidates(video.duration || durationSeconds);
            video.currentTime = candidates[0] || 0.15;
          }}
          onError={() => {
            setVideoFailed(true);
            setVideoReady(false);
          }}
        />
      ) : null}

      {!previewFallback && videoFailed ? <div className="media-thumbnail__status">Preview unavailable</div> : null}
    </div>
  );
}
