import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasLocale } from "@/i18n/config";
import { getDefaultDictionary } from "@/i18n/dictionaries";
import { siteUrl } from "@/lib/site";

// Shareable picture of a streak or a badge (dashboard → Share). Public and stateless: everything
// it shows comes from the query string, and nothing personal is in it (no name, no email).
//   /api/share?kind=streak&n=12&lang=tr&course=sq
//   /api/share?kind=badge&badge=streak7&lang=sq&course=tr

const SIZE = 1080;
const BADGES = ["firstLesson", "streak3", "streak7", "words25", "favorites3", "lessons10"] as const;
type Badge = (typeof BADGES)[number];

// DM Sans (SIL Open Font License), the app's font. Read once per server instance.
const fonts = Promise.all(
  (
    [
      ["dm-sans-latin-400-normal.woff", 400],
      ["dm-sans-latin-ext-400-normal.woff", 400],
      ["dm-sans-latin-700-normal.woff", 700],
      ["dm-sans-latin-ext-700-normal.woff", 700],
    ] as const
  ).map(async ([file, weight]) => ({
    name: "DM Sans",
    data: await readFile(join(process.cwd(), "assets/fonts", file)),
    weight,
    style: "normal" as const,
  })),
);

const FLAME =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";
const AWARD =
  "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526M18 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0z";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");
  const lang = hasLocale(langParam) ? langParam : "tr";
  const course = url.searchParams.get("course") === "tr" ? "tr" : "sq";
  const kind = url.searchParams.get("kind") === "badge" ? "badge" : "streak";
  const n = Math.max(0, Math.min(9999, Number.parseInt(url.searchParams.get("n") ?? "0", 10) || 0));
  const badgeParam = url.searchParams.get("badge");
  const badge: Badge = (BADGES as readonly string[]).includes(badgeParam ?? "") ? (badgeParam as Badge) : "firstLesson";

  const t = (await getDefaultDictionary(lang)).dashboard;
  const learning = course === "tr" ? t.shareLearningTr : t.shareLearningSq;
  const kicker = kind === "streak" ? learning : t.shareNewBadge;
  const title = kind === "streak" ? t.shareStreakTitle.replace("{n}", String(n)) : t.badges[badge].title;
  const body = kind === "streak" ? "" : t.badges[badge].body;
  const host = new URL(siteUrl).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E1A22",
          color: "#FBF9F8",
          fontFamily: "DM Sans",
          position: "relative",
        }}
      >
        {/* The brand's dotted arc */}
        <svg width="900" height="420" viewBox="0 0 200 100" style={{ position: "absolute", top: 70 }}>
          <path d="M10 95 Q100 -25 190 95" fill="none" stroke="#E3B23C" strokeWidth="2.2" strokeDasharray="1.5 6" strokeLinecap="round" />
        </svg>
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: 96,
            background: kind === "streak" ? "#C1272D" : "#E3B23C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          <svg width="180" height="180" viewBox="0 0 24 24" fill={kind === "streak" ? "#FFFFFF" : "none"} stroke={kind === "streak" ? "#FFFFFF" : "#1E1A22"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={kind === "streak" ? FLAME : AWARD} />
          </svg>
        </div>
        <div style={{ marginTop: 64, fontSize: 40, fontWeight: 700, color: "#E3B23C", letterSpacing: 2, textTransform: "uppercase" }}>{kicker}</div>
        <div style={{ marginTop: 16, fontSize: 104, fontWeight: 700, textAlign: "center", lineHeight: 1.05, maxWidth: 940 }}>{title}</div>
        {body && <div style={{ marginTop: 24, fontSize: 44, color: "rgba(251,249,248,0.75)", textAlign: "center", maxWidth: 900 }}>{body}</div>}
        {kind === "badge" && <div style={{ marginTop: 24, fontSize: 40, color: "rgba(251,249,248,0.75)" }}>{learning}</div>}
        <div style={{ position: "absolute", bottom: 72, display: "flex", alignItems: "center", gap: 18, fontSize: 44, fontWeight: 700 }}>
          <div style={{ width: 40, height: 32, borderRadius: 10, background: "#C1272D" }} />
          <div style={{ width: 40, height: 32, borderRadius: 10, background: "#FBF9F8", marginLeft: -6 }} />
          <span style={{ marginLeft: 8 }}>mirhaba</span>
          <span style={{ fontWeight: 400, color: "rgba(251,249,248,0.6)", fontSize: 36 }}>· {host}</span>
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      fonts: await fonts,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
    },
  );
}
