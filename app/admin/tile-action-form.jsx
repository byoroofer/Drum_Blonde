"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function TileActionForm({ action, children, className, style }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Remove returnTo — we handle navigation ourselves
    formData.delete("returnTo");
    await action(formData);
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
