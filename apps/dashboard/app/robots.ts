import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, absoluteUrl, isLocalSite } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // A copy running on a laptop or a preview address should never end up in search results
  if (isLocalSite) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
