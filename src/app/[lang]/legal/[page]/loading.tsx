/** Skeleton shaped like a legal page: title, notice, paragraphs. */
export default function Loading() {
  return (
    <div aria-hidden="true" className="max-w-prose space-y-4 py-2">
      <div className="skeleton h-9 w-2/3 rounded-lg" />
      <div className="skeleton h-12 rounded-xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-4 rounded" />
          <div className="skeleton h-4 w-11/12 rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
}
