/** Skeleton shaped like the Quick Talk screen: title, search, chips, grouped list. */
export default function Loading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="skeleton h-9 w-48 rounded-lg" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="skeleton h-12 rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 border-b border-hairline px-4 py-3.5 last:border-b-0">
            <div className="skeleton h-4 w-3/5 rounded" />
            <div className="skeleton h-3.5 w-2/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
