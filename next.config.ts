import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds the Course Lab as a static site (GitHub Pages): no API routes, the
// pipeline runs in the browser with a bring-your-own free Groq key or the labeled fixture replay.
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = isStatic ? process.env.STATIC_BASE_PATH ?? "/benchmate" : "";

const nextConfig: NextConfig = {
  // PPR / cache components are not supported in export mode.
  cacheComponents: !isStatic,
  partialPrefetching: !isStatic,
  ...(isStatic
    ? { output: "export" as const, basePath, images: { unoptimized: true }, env: { NEXT_PUBLIC_STATIC_EXPORT: "1", NEXT_PUBLIC_BASE_PATH: basePath } }
    : {}),
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
