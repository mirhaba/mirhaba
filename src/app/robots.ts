import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/tr/app", "/sq/app", "/tr/login", "/sq/login", "/admin/", "/tr/offline", "/sq/offline"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
