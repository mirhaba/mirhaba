import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/site";

/** The origin the visitor is on, so links we hand to third parties (login emails, payment return pages) come back here. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return siteUrl;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
