"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Download,
  Flag,
  Gauge,
  GraduationCap,
  Languages,
  LayoutDashboard,
  MessageCircle,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";

const items: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/quick-talk", label: "Quick Talk", Icon: MessageCircle },
  { href: "/admin/dictionary", label: "Dictionary", Icon: BookOpen },
  { href: "/admin/lessons", label: "Lessons", Icon: GraduationCap },
  { href: "/admin/translations", label: "Fixed translations", Icon: Languages },
  { href: "/admin/texts", label: "UI text", Icon: Type },
  { href: "/admin/reports", label: "Reports", Icon: Flag },
  { href: "/admin/users", label: "Users & Premium", Icon: Users },
  { href: "/admin/activity", label: "Activity log", Icon: Activity },
  { href: "/admin/import", label: "Import starter content", Icon: Download },
  { href: "/admin/system", label: "System check", Icon: Gauge },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] font-medium whitespace-nowrap ${
              active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
