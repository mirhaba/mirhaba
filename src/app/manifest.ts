import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mirhaba",
    short_name: "Mirhaba",
    description: "Kosova'da yaşayanlar için hazır Arnavutça cümleler, argo çeviri ve dersler. İnternetsiz çalışır.",
    lang: "tr",
    // "/" rather than "/tr": the proxy sends it to the language the person chose (cookie), else the browser's.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF9F8",
    theme_color: "#C1272D",
    categories: ["education", "travel", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
