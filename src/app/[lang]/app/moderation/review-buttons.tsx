"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import type { Messages } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/toast";
import { reviewCorrection } from "./actions";

/** Reject (secondary) and Approve (primary) for one correction. */
export function ReviewButtons({ id, t }: { id: string; t: Messages["moderation"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [toast, setToast] = useState("");
  const [, startTransition] = useTransition();

  const review = (status: "approved" | "rejected") => {
    setBusy(status);
    startTransition(async () => {
      const result = await reviewCorrection({ id, status });
      setBusy(null);
      if (result.ok) {
        setToast(t.saved);
        router.refresh(); // the item leaves the pending list
      } else {
        setToast(t.saveError);
      }
    });
  };

  return (
    <div className="flex justify-end gap-2 border-t border-hairline px-4 py-3">
      <Button variant="secondary" className="h-11" loading={busy === "rejected"} disabled={!!busy} onClick={() => review("rejected")}>
        {busy !== "rejected" && <X aria-hidden="true" className="h-4 w-4" />}
        {t.reject}
      </Button>
      <Button className="h-11" loading={busy === "approved"} disabled={!!busy} onClick={() => review("approved")}>
        {busy !== "approved" && <Check aria-hidden="true" className="h-4 w-4" />}
        {t.approve}
      </Button>
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
