"use client";

import { sendTrackingEvent } from "@/app/components/tracking";

export default function TrackableLink({
  href,
  mediaId,
  eventLabel,
  className,
  children,
  target = "_blank",
  rel = "noreferrer"
}) {
  return (
    <a
      className={className}
      href={href}
      target={target}
      rel={rel}
      onClick={() =>
        sendTrackingEvent({
          type: "link_click",
          href,
          mediaId: mediaId || null,
          pathname: "/",
          label: eventLabel || href
        })
      }
    >
      {children}
    </a>
  );
}

