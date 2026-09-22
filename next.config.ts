import type { NextConfig } from "next";

// Routes that render slides with headless Chromium need its binary in their serverless bundle.
const RENDER_ROUTES = ["/campaigns/**", "/api/**"];

const nextConfig: NextConfig = {
  // The dev indicator is fixed on screen and would end up in slide screenshots taken locally.
  devIndicators: false,
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],
  outputFileTracingIncludes: Object.fromEntries(
    RENDER_ROUTES.map((route) => [route, ["./node_modules/@sparticuz/chromium/bin/**/*"]]),
  ),
};

export default nextConfig;
