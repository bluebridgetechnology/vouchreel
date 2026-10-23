import { getSession } from "@/lib/auth/session";
import { SiteHeaderBar } from "@/components/marketing/site-header-bar";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const session = await getSession();
  return <SiteHeaderBar links={links} signedIn={Boolean(session?.user)} />;
}
