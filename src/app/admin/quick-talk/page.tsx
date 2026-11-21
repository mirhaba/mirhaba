import { requireAdmin } from "@/lib/admin/auth";
import { contentNotImported } from "@/lib/admin/data";
import { getQuickTalk } from "@/lib/content/queries";
import { ActionForm } from "../_ui/form";
import { Badge, Card, LinkList, PageHeader } from "../_ui/ui";
import { NotImported } from "../_ui/not-imported";
import { saveCategory } from "./actions";
import { CategoryFields } from "./fields";

export const metadata = { title: "Quick Talk" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function QuickTalkAdmin() {
  await requireAdmin();
  const [{ categories, replies }, empty] = await Promise.all([getQuickTalk(), contentNotImported("phrase_categories")]);

  return (
    <>
      <PageHeader
        title="Quick Talk"
        description="Categories and ready-made phrases on the home screen. Open a category to edit its phrases."
      />
      {empty && <NotImported />}
      <div className="flex flex-col gap-6">
        <LinkList
          empty="No categories yet."
          items={categories.map((c) => ({
            href: `/admin/quick-talk/${c.slug}`,
            title: `${c.name.tr} · ${c.name.sq}`,
            subtitle: `${c.phrases.length} phrases · /${c.slug}`,
            meta: c.basic ? <Badge tone="good">Offline basics</Badge> : undefined,
          }))}
        />
        <LinkList
          empty=""
          items={[{ href: "/admin/quick-talk/replies", title: "Reply buttons", subtitle: `${Object.keys(replies).length} answers the other person can tap (Po, Jo, Prit pak…)` }]}
        />
        <Card title="New category">
          <ActionForm action={saveCategory} submitLabel="Create category">
            <CategoryFields />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
