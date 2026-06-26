import type { MetadataRoute } from "next";

/**
 * Until is a personal tool, not a public site. Disallow all crawlers so the
 * Vercel deployment never shows up in search results. (Access is already gated by
 * the Drive OAuth consent screen staying in Testing mode — this only handles
 * discoverability.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
