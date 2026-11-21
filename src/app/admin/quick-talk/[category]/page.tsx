import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getQuickTalk } from "@/lib/content/queries";
import { ActionForm } from "../../_ui/form";
import { Badge, Card, LinkList, PageHeader } from "../../_ui/ui";
import { deleteCategory, saveCategory } from "../actions";
import { CategoryFields } from "../fields";

export const metadata = { title: "Category" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function CategoryAdmin({ params }: PageProps<"/admin/quick-talk/[category]">) {
  await requireAdmin();
  const { category: slug } = await params;
  const { categories } = await getQuickTalk();
  const index = categories.findIndex((c) => c.slug === slug);
  const category = categories[index];
  if (!category) notFound();

  return (
    <>
      <PageHeader
        title={`${category.name.tr} · ${category.name.sq}`}
        back={{ href: "/admin/quick-talk", label: "Quick Talk" }}
        actions={
          <Link href={`/admin/quick-talk/${slug}/new`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent">
            Add phrase
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        <LinkList
          empty="No phrases in this category yet."
          items={category.phrases.map((p) => ({
            href: `/admin/quick-talk/${slug}/${p.id}`,
            title: p.tr,
            subtitle: p.sq,
            meta: (
              <span className="flex gap-1">
                {p.slot && <Badge>fill-in</Badge>}
                {p.replies && <Badge>{p.replies.length} replies</Badge>}
                {p.audio && <Badge tone="good">audio</Badge>}
              </span>
            ),
          }))}
        />

        <Card title="Category settings">
          <ActionForm action={saveCategory}>
            <CategoryFields value={{ slug, tr: category.name.tr, sq: category.name.sq, icon: category.icon, basic: category.basic, sort: index }} />
          </ActionForm>
        </Card>

        <Card title="Delete category" description="Only possible when it has no phrases.">
          <ActionForm action={deleteCategory} submitLabel="Delete category" danger confirm={`Delete the category "${category.name.tr}"?`}>
            <input type="hidden" name="slug" value={slug} />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
