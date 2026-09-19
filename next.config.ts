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

  /**
   * Photographs volunteers upload live in Supabase Storage, so the optimiser
   * has to be told that host is allowed. Without this every collage picture is
   * a 403 — and with `unoptimized` instead, every one of them is a four
   * megabyte download on a phone.
   */
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" }],
  },
};

export default nextConfig;
