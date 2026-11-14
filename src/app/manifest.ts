import type { MetadataRoute } from "next";

/** Makes the portal installable as an app on phones, laptops and PCs (Chrome, Edge, Android). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tirvex School System",
    short_name: "Tirvex School",
    description: "School management: admissions, attendance, fees, marks and messages. Works offline.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#21232e",
    theme_color: "#21232e",
    categories: ["education", "productivity", "business"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Take attendance", url: "/app/attendance", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Collect fees", url: "/app/fees/collect", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
