"use client";

import { useParams } from "next/navigation";
import { RotateCw, TriangleAlert } from "lucide-react";
import { StateView } from "@/components/state-view";
import tr from "../../../messages/tr.json";
import sq from "../../../messages/sq.json";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang?: string }>();
  const t = params?.lang === "sq" ? sq : tr;

  return (
    <div role="alert">
      <StateView
        Icon={TriangleAlert}
        tone="error"
        title={t.error.title}
        body={t.error.body}
        action={
          <button
            type="button"
            onClick={reset}
            className="pressable inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-accent-pressed"
          >
            <RotateCw aria-hidden="true" className="h-4 w-4" />
            {t.error.retry}
          </button>
        }
      />
    </div>
  );
}
