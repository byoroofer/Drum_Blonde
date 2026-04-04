"use client";

import { useEffect, useRef, useState } from "react";
import { sendTrackingEvent } from "@/app/components/tracking";

const HLS_PATTERN = /\.m3u8($|\?)/i;

function isHlsSource(source) {
  return Boolean(source && HLS_PATTERN.test(source));
}

export default function TrackableVideo({
  src,
  playbackUrl,
  poster,
  title,
  mediaId,
  autoPlay = false,
  loop = false,
  muted,
  controls = true,
  playsInline = true,
  className,
  eager = false,
  showPlayButton = !autoPlay
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const attachedSourceRef = useRef("");
  const tracked = useRef(false);
  const shouldMute = muted ?? autoPlay;
  const sourceUrl = playbackUrl || src || "";
  const isHls = isHlsSource(sourceUrl);
  const [isActivated, setIsActivated] = useState(autoPlay || eager);
  const [shouldLoad, setShouldLoad] = useState(autoPlay || eager);
  const [isVisible, setIsVisible] = useState(autoPlay || eager);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      if (autoPlay) {
        setShouldLoad(true);
        setIsActivated(true);
        setIsVisible(true);
      }

      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (autoPlay && entry.isIntersecting) {
          setShouldLoad(true);
          setIsActivated(true);
        }

        setIsVisible(entry.isIntersecting && entry.intersectionRatio > 0.35);
      },
      {
        rootMargin: autoPlay ? "240px" : "120px",
        threshold: [0, 0.2, 0.35, 0.6]
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [autoPlay]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl || !(autoPlay ? shouldLoad : isActivated)) {
      return;
    }

    let cancelled = false;

    async function attachSource() {
      if (attachedSourceRef.current === sourceUrl) {
        return;
      }

      setLoadError("");
      setIsReady(false);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();

      if (isHls) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = sourceUrl;
          video.load();
          attachedSourceRef.current = sourceUrl;
          return;
        }

        const { default: Hls } = await import("hls.js");
        if (cancelled) {
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
          });

          hlsRef.current = hls;
          hls.loadSource(sourceUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data.fatal) {
              return;
            }

            setLoadError("Video stream failed to load.");
            hls.destroy();
            if (hlsRef.current === hls) {
              hlsRef.current = null;
            }
          });
          attachedSourceRef.current = sourceUrl;
          return;
        }
      }

      video.src = sourceUrl;
      video.load();
      attachedSourceRef.current = sourceUrl;
    }

    attachSource().catch(() => {
      if (!cancelled) {
        setLoadError("Video failed to load.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [autoPlay, isActivated, isHls, shouldLoad, sourceUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay || !shouldLoad) {
      return;
    }

    if (isVisible) {
      video.play().catch(() => {});
      return;
    }

    video.pause();
  }, [autoPlay, isVisible, shouldLoad]);

  function activatePlayback() {
    setIsActivated(true);
    setShouldLoad(true);
    setLoadError("");
  }

  return (
    <div
      ref={containerRef}
      className={[
        "smart-video",
        className,
        autoPlay ? "smart-video--autoplay" : "",
        isActivated ? "smart-video--active" : "",
        isReady ? "smart-video--ready" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={shouldMute}
        controls={controls && (isActivated || autoPlay)}
        playsInline={playsInline}
        preload={autoPlay ? "metadata" : "none"}
        onCanPlay={() => {
          setIsReady(true);

          if (autoPlay || isActivated) {
            videoRef.current?.play().catch(() => {});
          }
        }}
        onPlay={() => {
          setIsPlaying(true);

          if (tracked.current || !mediaId) {
            return;
          }

          tracked.current = true;
          sendTrackingEvent({
            type: "video_play",
            pathname: "/",
            mediaId
          });
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
      />

      {showPlayButton && !isActivated ? (
        <button
          type="button"
          className="smart-video__button"
          onClick={activatePlayback}
          aria-label={title ? `Play ${title}` : "Play video"}
        >
          <span className="smart-video__button-icon" aria-hidden="true">{">"}</span>
          <span>{title ? `Play ${title}` : "Play clip"}</span>
        </button>
      ) : null}

      {isActivated && !isReady && !isPlaying && !loadError ? (
        <div className="smart-video__status">Loading video...</div>
      ) : null}

      {loadError ? <div className="smart-video__status">{loadError}</div> : null}
    </div>
  );
}

