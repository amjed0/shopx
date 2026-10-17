import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShopX Elite",
    short_name: "ShopX",
    description: "ShopX Elite POS & Inventory Management",
    start_url: "/",
    display: "standalone",
    background_color: "#0d111c",
    theme_color: "#0d111c",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  }
}
