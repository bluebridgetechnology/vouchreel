import Link from "next/link";
import { Container } from "@/components/ui/layout";
import { Logo } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Create account" },
      { href: "/login", label: "Sign in" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-surface-sunken">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-text-muted">
            Video testimonials that turn visitors into customers. Collect with one link, embed anywhere.
          </p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-medium">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-text-muted">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-text">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className="text-sm font-medium">Support</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-text-muted">
            <li>
              <a href="mailto:support@vouchreel.com" className="transition-colors hover:text-text">
                support@vouchreel.com
              </a>
            </li>
          </ul>
        </div>
      </Container>

      <div className="border-t">
        <Container className="flex flex-col items-center justify-between gap-4 py-6 text-xs text-text-subtle sm:flex-row">
          <p>© {new Date().getFullYear()} Vouchreel. All rights reserved.</p>
          <ThemeToggle />
        </Container>
      </div>
    </footer>
  );
}
