import type { MetadataRoute } from "next";

/**
 * Makes the app installable: residents open the link once, tap "Add to Home
 * Screen", and it launches full-screen with its own icon — no app store needed.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UtsavKosh — activities & funds",
    // Fits under a home-screen icon without truncating.
    short_name: "UtsavKosh",
    description:
      "Every rupee collected and spent, every activity planned, and every photograph — open to all residents.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#0e5c4b",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
