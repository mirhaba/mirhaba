import Link from "next/link";
import { Compass } from "lucide-react";
import { StateView } from "@/components/state-view";
import tr from "../../../messages/tr.json";
import sq from "../../../messages/sq.json";

// not-found.tsx gets no params, so show both languages; the main action goes to the default locale.
export default function NotFound() {
  return (
    <>
      <StateView Icon={Compass} title={tr.notFound.title} body={tr.notFound.body} action={{ label: tr.notFound.cta, href: "/tr" }} />
      <p lang="sq" className="-mt-6 text-center text-[15px] text-muted">
        {sq.notFound.title}.{" "}
        <Link href="/sq" className="inline-flex min-h-11 items-center font-medium text-accent-text">
          {sq.notFound.cta}
        </Link>
      </p>
    </>
  );
}
