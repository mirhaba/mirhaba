// Renders every PNG / ICO brand asset from the SVG sources in public/brand and src/app/icon.svg.
//
//   npm run icons
//
// Sources are the final brand SVGs (never edit their geometry here). Text (wordmark, tagline)
// is set in DM Sans via Satori, which turns it into vector paths, then rasterised by sharp,
// so the output doesn't depend on fonts installed on this machine.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import satori from "satori";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => path.join(root, ...parts);

const INK = "#1E1A22";
const RED = "#C1272D";
const PAPER = "#FBF9F8";
const BODY = "#4A4550";

const BUBBLE =
  "M12 2 H28 A10 10 0 0 1 38 12 V16 A10 10 0 0 1 28 26 H20 L9 34 L11 26 A10 10 0 0 1 2 16 V12 A10 10 0 0 1 12 2 Z";

/** Rasterise an SVG string/buffer to a PNG of the given size (density keeps edges crisp). */
const png = (svg, width, height = width) =>
  sharp(Buffer.from(svg), { density: 600 }).resize(width, height).png({ compressionLevel: 9 }).toBuffer();

async function write(rel, data) {
  await mkdir(path.dirname(p(rel)), { recursive: true });
  await writeFile(p(rel), data);
  console.log("wrote", rel);
}

const fonts = [
  ["latin-400", 400],
  ["latin-ext-400", 400],
  ["latin-700", 700],
  ["latin-ext-700", 700],
];
const fontData = await Promise.all(
  fonts.map(async ([file, weight]) => ({
    name: "DM Sans",
    weight,
    style: "normal",
    data: await readFile(p("node_modules/@fontsource/dm-sans/files", `dm-sans-${file}-normal.woff`)),
  })),
);

/** The logo mark as a Satori element (inline SVG), sized by height. Colours: light variant. */
const mark = (height) => ({
  type: "svg",
  props: {
    width: (height * 300) / 180,
    height,
    viewBox: "0 0 300 180",
    children: [
      { type: "path", props: { d: "M70 112 Q150 10 230 112", fill: "none", stroke: INK, strokeWidth: 10, strokeLinecap: "round", strokeDasharray: "1 22" } },
      { type: "path", props: { d: BUBBLE, fill: RED, transform: "translate(16 108) scale(1.8)" } },
      { type: "path", props: { d: BUBBLE, fill: INK, transform: "translate(284 108) scale(-1.8 1.8)" } },
    ],
  },
});

const wordmark = (fontSize) => ({
  type: "span",
  props: { style: { fontFamily: "DM Sans", fontWeight: 700, fontSize, letterSpacing: "-0.03em", color: INK, lineHeight: 1 }, children: "mirhaba" },
});

// ---------- 1. Favicon (multi-size ICO) from the simplified two-bubble icon ----------
const faviconSvg = await readFile(p("src/app/icon.svg"));
const icoSizes = await Promise.all([16, 32, 48].map((s) => png(faviconSvg, s)));
await write("src/app/favicon.ico", await pngToIco(icoSizes));

// ---------- 2. App icons ----------
const appIcon = await readFile(p("public/brand/app-icon.svg"), "utf8");
const maskable = await readFile(p("public/brand/app-icon-maskable.svg"), "utf8");
// iOS rounds the corners itself, so the apple icon is the same art on a square background.
const appIconSquare = appIcon.replace('<rect width="200" height="200" rx="44" fill="#C1272D"/>', '<rect width="200" height="200" fill="#C1272D"/>');
if (appIconSquare === appIcon) throw new Error("apple icon: rounded rect not found in app-icon.svg");

await write("src/app/apple-icon.png", await png(appIconSquare, 180));
await write("public/icons/icon-192.png", await png(appIcon, 192));
await write("public/icons/icon-512.png", await png(appIcon, 512));
await write("public/icons/icon-maskable-512.png", await png(maskable, 512));

// ---------- 3. Email logo: mark + wordmark on white, 480 px wide (shown at 240 px = 2× density) ----------
{
  const width = 480;
  const height = 120;
  const markHeight = 72;
  const svg = await satori(
    {
      type: "div",
      props: {
        style: { width, height, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", gap: markHeight * 0.4 },
        children: [mark(markHeight), wordmark(56)],
      },
    },
    { width, height, fonts: fontData },
  );
  await write("public/brand/mirhaba-logo-email.png", await png(svg, width, height));
}

// ---------- 4. Open Graph image (1200×630): mark + wordmark + "Türkçe ↔ Shqip" ----------
{
  const width = 1200;
  const height = 630;
  const markHeight = 150;
  // The ↔ arrow is drawn as a path: DM Sans has no arrow glyph.
  const arrow = {
    type: "svg",
    props: {
      width: 56,
      height: 28,
      viewBox: "0 0 56 28",
      children: [
        { type: "path", props: { d: "M6 14 H50 M14 5 L5 14 L14 23 M42 5 L51 14 L42 23", fill: "none", stroke: RED, strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } },
      ],
    },
  };
  const svg = await satori(
    {
      type: "div",
      props: {
        style: { width, height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: PAPER, gap: 44 },
        children: [
          { type: "div", props: { style: { display: "flex", alignItems: "center", gap: markHeight * 0.4 }, children: [mark(markHeight), wordmark(128)] } },
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", gap: 22, fontFamily: "DM Sans", fontWeight: 400, fontSize: 48, color: BODY },
              children: [{ type: "span", props: { children: "Türkçe" } }, arrow, { type: "span", props: { children: "Shqip" } }],
            },
          },
        ],
      },
    },
    { width, height, fonts: fontData },
  );
  // Lives next to the [lang] layout: that layout sets openGraph metadata, which would hide an app-root image.
  await write("src/app/[lang]/opengraph-image.png", await png(svg, width, height));
}

console.log("done");
