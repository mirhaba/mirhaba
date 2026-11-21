import Link from "next/link";

export function NotImported() {
  return (
    <p className="mb-4 rounded-xl bg-amber-500/15 px-4 py-3 text-[15px] text-amber-800 dark:text-amber-200">
      This section is still showing the built-in starter content, which isn&apos;t in the database yet.{" "}
      <Link href="/admin/import" className="font-semibold underline">
        Import starter content
      </Link>{" "}
      first, then edit it here.
    </p>
  );
}
