import { notFound } from "next/navigation";

// Any unknown path under /tr or /sq renders the localized 404 inside the layout.
export default function CatchAll() {
  notFound();
}
