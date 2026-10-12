import type { NextConfig } from "next";

import { cabecerasDeSeguridad } from "./lib/seguridad/cabeceras";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecerasDeSeguridad({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          desarrollo: process.env.NODE_ENV !== "production",
        }),
      },
    ]
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
