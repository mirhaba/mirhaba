import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * One layout for every empty / error / offline / 404 / coming-soon screen:
 * a quiet icon, one clear title, one line of help, one primary way forward.
 */
export function StateView({
  Icon,
  visual,
  title,
  body,
  action,
  tone = "neutral",
  headingLevel = 1,
}: {
  /** Small icon in a tile, or… */
  Icon?: LucideIcon;
  /** …any visual instead (e.g. the logo mark on the offline/splash screen). */
  visual?: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; href: string } | React.ReactNode;
  tone?: "neutral" | "error";
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="fade-in flex flex-col items-center px-4 py-12 text-center">
      {visual ?? (Icon && (
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            tone === "error" ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-muted"
          }`}
        >
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
        </div>
        ))}
      <Heading className={`mt-4 font-semibold ${headingLevel === 1 ? "text-2xl" : "text-lg"}`}>{title}</Heading>
      {body && <p className="mt-1.5 max-w-sm text-[15px] text-muted">{body}</p>}
      {action && typeof action === "object" && "href" in action ? (
        <Link
          href={action.href}
          className="pressable mt-6 inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-accent-pressed"
        >
          {action.label}
        </Link>
      ) : (
        action && <div className="mt-6">{action}</div>
      )}
    </div>
  );
}
