import { requireAdmin } from "@/lib/admin/auth";
import { ActionForm } from "../_ui/form";
import { Card, PageHeader } from "../_ui/ui";
import { importStarter } from "./actions";

export const metadata = { title: "Import starter content" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function ImportAdmin() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Import starter content"
        description="Copies the built-in phrases, dictionary words, sources and lessons into the database so you can edit them here."
      />
      <Card>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-[15px] text-muted">
          <li>Only adds what&apos;s missing and fills empty fields. It never overwrites anything you edited.</li>
          <li>Something you deleted on purpose comes back if it&apos;s part of the starter content, so only run this when needed.</li>
          <li>Safe to run more than once.</li>
        </ul>
        <ActionForm action={importStarter} submitLabel="Import now" confirm="Import the starter content into the database?" />
      </Card>
    </>
  );
}
