import { getSession } from "@/lib/auth/session";
import { SiteHeaderBar } from "@/components/marketing/site-header-bar";

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

export async function SiteHeader() {
  const session = await getSession();
  return <SiteHeaderBar links={links} signedIn={Boolean(session?.user)} />;
}
