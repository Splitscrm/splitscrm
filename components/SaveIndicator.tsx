"use client";

import { useState, useEffect, useRef } from "react";
import { type SaveStatus } from "@/lib/use-auto-save";

interface SaveIndicatorProps {
  status: SaveStatus;
}

export default function SaveIndicator({ status }: SaveIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (status === "idle") {
      setVisible(false);
      return;
    }

    setDisplayStatus(status);
    setVisible(true);

    if (status === "saved") {
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status]);

  if (!visible) return null;

  switch (displayStatus) {
    case "unsaved":
      return <span className="text-xs text-slate-400">Unsaved changes</span>;
    case "saving":
      return (
        <span className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving…
        </span>
      );
    case "saved":
      return <span className="text-xs text-emerald-500">✓ Saved</span>;
    case "error":
      return <span className="text-xs text-red-500">⚠ Save failed</span>;
    default:
      return null;
  }
}
