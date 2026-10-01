import { SiteHeader } from "@/components/marketing/site-header";
import { fontAccent } from "@/lib/fonts-accent";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${fontAccent.variable} flex min-h-screen flex-col bg-canvas text-text`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-(--z-modal) focus:rounded-pill focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-text-on-accent"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
