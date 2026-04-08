"use client";

import ImageMediaEditor from "@/app/admin/image-media-editor";
import VideoMediaEditor from "@/app/admin/video-media-editor";

export default function MediaAssetEditor({ item, returnTo }) {
  if (!item) {
    return null;
  }

  if (item.kind === "video") {
    return <VideoMediaEditor item={item} returnTo={returnTo} />;
  }

  return <ImageMediaEditor item={item} returnTo={returnTo} />;
}
