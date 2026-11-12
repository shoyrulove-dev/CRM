import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nichiei Asia Customer Relationship Management",
    short_name: "Nichiei CRM",
    description: "Hệ thống chăm sóc và quản lý khách hàng của Nichiei Asia",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffdf8",
    theme_color: "#fbd665",
    orientation: "any",
    lang: "vi",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
