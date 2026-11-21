import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";
import { getAdmin } from "@/lib/admin/auth";
import { getUser } from "@/lib/supabase/server";
import { AdminNav } from "./_ui/nav";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin", "latin-ext"], weight: ["400", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Mirhaba admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#C1272D", width: "device-width", initialScale: 1 };

// The admin dashboard has its own root layout (no site header/footer, English UI).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
          <aside className="border-b border-hairline md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
            <div className="flex items-center justify-between px-4 py-4">
              <Link href="/admin" className="text-[18px] font-bold">
                mirhaba <span className="text-accent-text">admin</span>
              </Link>
              <Link href="/tr" className="text-[13px] font-medium text-muted hover:text-foreground">
                View site ↗
              </Link>
            </div>
            {/* Reads the URL for the active link, so it renders after the static shell. */}
            <Suspense fallback={<div className="h-10 md:h-96" />}>
              <AdminNav />
            </Suspense>
          </aside>
          <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-8">
            <Suspense fallback={<AdminSkeleton />}>
              <AdminGate>{children}</AdminGate>
            </Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}

/** Only admins (ADMIN_EMAILS) see anything; everyone else gets a plain 404. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) {
    if (!(await getUser())) redirect(`/tr/login?next=${encodeURIComponent("/admin")}`);
    notFound();
  }
  return (
    <>
      <p className="mb-4 text-right text-[12px] text-muted">Signed in as {admin.email}</p>
      {children}
    </>
  );
}

function AdminSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="skeleton h-9 w-1/3 rounded-lg" />
      <div className="skeleton h-5 w-1/2 rounded" />
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  );
}
