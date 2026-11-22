import { Suspense } from "react";
import { LocalizedNotFound, NotFoundView } from "./not-found-content";

// not-found.tsx gets no params: the client part reads the URL so /sq/... shows Albanian first.
// Until it renders (or without JavaScript) the Turkish-first version is shown.
export default function NotFound() {
  return (
    <Suspense fallback={<NotFoundView lang="tr" />}>
      <LocalizedNotFound />
    </Suspense>
  );
}
