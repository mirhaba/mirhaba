"use client";

import { useEffect } from "react";
import { Info } from "lucide-react";

/** Small glass toast above the tab bar. Never `alert()`. Auto-hides after 3.5 s. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-6">
      {message && (
        <p
          key={message}
          className="fade-in flex items-center gap-2 rounded-full bg-foreground/85 px-4 py-2.5 text-[15px] text-background shadow-float backdrop-blur-xl"
        >
          <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
