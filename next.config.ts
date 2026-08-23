import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The generator is a static file that changes when we fix something. Without
   * this it is cached by the browser and the edge, so a fix looks like it
   * hasn't deployed — which cost real debugging time twice.
   */
  async headers() {
    return [
      {
        source: "/receipt-generator.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },

  /* config options here */
};

export default nextConfig;
