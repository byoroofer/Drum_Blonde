"use client";

import { useRouter } from "next/navigation";
import { useTransition, useEffect, useRef } from "react";

export default function TileActionForm({ action, children, className, style }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const savedScroll = useRef(null);

  // After every render, if we have a saved scroll position, restore it
  useEffect(() => {
    if (savedScroll.current !== null) {
      const y = savedScroll.current;
      savedScroll.current = null;
      // Use requestAnimationFrame to wait for paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" });
        });
      });
    }
  });

  async function handleSubmit(e) {
    e.preventDefault();
    savedScroll.current = window.scrollY;
    const formData = new FormData(e.currentTarget);
    try {
      await action(formData);
    } catch {
      // server action threw (e.g. auth error) — still restore scroll
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} style={style}>
      {children}
    </form>
  );
}
