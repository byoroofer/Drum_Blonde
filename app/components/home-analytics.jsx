"use client";

import { useEffect } from "react";
import { sendTrackingEvent } from "@/app/components/tracking";

export default function HomeAnalytics({ mediaIds }) {
  useEffect(() => {
    sendTrackingEvent({
      type: "page_view",
      pathname: "/",
      mediaIds: mediaIds.filter(Boolean)
    });
  }, [mediaIds]);

  return null;
}

