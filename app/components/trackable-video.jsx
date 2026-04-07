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
  clipStartSeconds = 0,
  clipEndSeconds = null,
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
  const clipAppliedRef = useRef(false);
  const tracked = useRef(false);
  const shouldMute = muted ?? autoPlay;
  const sourceUrl = playbackUrl || src || "";
  const isHls = isHlsSource(sourceUrl);
  const normalizedClipStart = Number.isFinite(Number(clipStartSeconds)) ? Math.max(0, Number(clipStartSeconds)) : 0;
  const normalizedClipEnd = Number.isFinite(Number(clipEndSeconds)) && Number(clipEndSeconds) > normalizedClipStart
    ? Number(clipEndSeconds)
    : null;
  const [isActivated, setIsActivated] = useState(autoPlay || eager);
  const [shouldLoad, setShouldLoad] = useState(autoPlay || eager);
  const [isVisible, setIsVisible] = useState(autoPlay || eager);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [playRequiresInteraction, setPlayRequiresInteraction] = useState(false);
  const [posterVisible, setPosterVisible] = useState(Boolean(poster));

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
    clipAppliedRef.current = false;
  }, [normalizedClipEnd, normalizedClipStart, sourceUrl]);

  useEffect(() => {
    setPosterVisible(Boolean(poster));
  }, [poster, sourceUrl]);

  useEffect(() => {
    setPlayRequiresInteraction(false);
  }, [sourceUrl, autoPlay]);

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
      setPlayRequiresInteraction(false);

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
      video.play().then(() => {
        setPlayRequiresInteraction(false);
      }).catch(() => {
        setPlayRequiresInteraction(true);
      });
      return;
    }

    video.pause();
  }, [autoPlay, isVisible, shouldLoad]);

  function activatePlayback() {
    setIsActivated(true);
    setShouldLoad(true);
    setLoadError("");
    setPlayRequiresInteraction(false);
    const video = videoRef.current;
    if (!video || (!video.currentSrc && !video.src && video.readyState === 0)) {
      return;
    }

    video.play().then(() => {
      setPlayRequiresInteraction(false);
    }).catch(() => {
      setPlayRequiresInteraction(true);
    });
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
      {poster && posterVisible ? (
        <img
          className="smart-video__poster"
          src={poster}
          alt={title || ""}
          loading={eager || autoPlay ? "eager" : "lazy"}
          decoding="async"
          aria-hidden={title ? undefined : true}
        />
      ) : null}

      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={shouldMute}
        controls={controls && (isActivated || autoPlay)}
        playsInline={playsInline}
        preload={autoPlay ? "metadata" : "none"}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (normalizedClipStart > 0 && !clipAppliedRef.current && Number.isFinite(video.duration) && video.duration > normalizedClipStart) {
            clipAppliedRef.current = true;
            video.currentTime = normalizedClipStart;
          }
        }}
        onCanPlay={() => {
          setIsReady(true);
          setPosterVisible(false);

          if (autoPlay || isActivated) {
            videoRef.current?.play().then(() => {
              setPlayRequiresInteraction(false);
            }).catch(() => {
              setPlayRequiresInteraction(true);
            });
          }
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (normalizedClipEnd == null || video.currentTime < normalizedClipEnd) {
            return;
          }

          if (loop || autoPlay) {
            video.currentTime = normalizedClipStart;
            video.play().catch(() => {});
            return;
          }

          video.pause();
          video.currentTime = normalizedClipEnd;
        }}
        onPlay={() => {
          setIsPlaying(true);
          setPosterVisible(false);
          setPlayRequiresInteraction(false);

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
        onWaiting={() => {
          if (!isPlaying) {
            setPosterVisible(Boolean(poster));
          }
        }}
      />

      {(showPlayButton && !isActivated) || playRequiresInteraction ? (
        <button
          type="button"
          className="smart-video__button"
          onClick={activatePlayback}
          aria-label={title ? `Play ${title}` : "Play video"}
        >
          <span className="smart-video__button-icon" aria-hidden="true">{">"}</span>
          <span>{playRequiresInteraction ? "Tap to play" : title ? `Play ${title}` : "Play clip"}</span>
        </button>
      ) : null}

      {isActivated && !isReady && !isPlaying && !loadError ? (
        <div className="smart-video__status">Loading video...</div>
      ) : null}

      {loadError ? <div className="smart-video__status">{loadError}</div> : null}
    </div>
  );
}

