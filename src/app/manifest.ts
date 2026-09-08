import type { MetadataRoute } from "next";

// Next serves this at /manifest.webmanifest and links it from every page, so
// the metadata export needs no `manifest` field. Typed, unlike a static file.
export default function manifest(): MetadataRoute.Manifest {
  const icons = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  ];

  return {
    id: "/",
    name: "Parinaamaa Attendance",
    short_name: "Attendance",
    description: "Corporate attendance and leave tracker",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "any",
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity"],
    background_color: "#09090b",
    theme_color: "#09090b",
    // Chrome wants `any` and `maskable` as separate entries, not one combined.
    icons: [
      ...icons.map((i) => ({ ...i, purpose: "any" as const })),
      ...icons.map((i) => ({ ...i, purpose: "maskable" as const })),
    ],
    shortcuts: [
      { name: "Apply for leave", short_name: "Apply Leave", url: "/leaves/new", icons: [icons[0]] },
      { name: "My leave", short_name: "Leave", url: "/leaves", icons: [icons[0]] },
    ],
  };
}
