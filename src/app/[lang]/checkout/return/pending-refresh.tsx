"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 3000;
const MAX_TRIES = 10;

/** Re-renders the (server-checked) payment status every 3 s, ~30 s in total, then shows a calm explanation. */
export function PendingRefresh({ slowText, accountHref, accountLabel }: { slowText: string; accountHref: string; accountLabel: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= MAX_TRIES) return;
    const timer = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, EVERY_MS);
    return () => clearTimeout(timer);
  }, [tries, router]);

  if (tries < MAX_TRIES) return null;
  return (
    <div className="fade-in -mt-6 flex flex-col items-center gap-3 px-4 text-center" role="status">
      <p className="max-w-sm text-[15px] text-muted">{slowText}</p>
      <a href={accountHref} className="inline-flex h-11 items-center px-3 text-[15px] font-medium text-accent-text">
        {accountLabel}
      </a>
    </div>
  );
}
