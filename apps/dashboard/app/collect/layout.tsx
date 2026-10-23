import type { Metadata } from "next";

// A testimonial form belongs to the business that sent the link: it is not for search results
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CollectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
