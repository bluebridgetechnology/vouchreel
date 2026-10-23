"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { Logo } from "@/components/marketing/logo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface HeaderLink {
  href: string;
  label: string;
}

/** How far the page scrolls before the bar tightens into a floating pill. */
const SCROLL_THRESHOLD = 50;
/** Tailwind's `md`: from here the links sit in the bar, below it they are in the menu. */
const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * The marketing site's header: logo, a pill of links and the call to action. Once the page has scrolled a little the
 * bar tightens into a floating, blurred pill. On a phone the links and buttons move into a sheet from the right.
 */
export function SiteHeaderBar({ links, signedIn }: { links: HeaderLink[]; signedIn: boolean }) {
  const pathname = usePathname();
  const [sticky, setSticky] = useState(false);
  const [open, setOpen] = useState(false);

  const onScroll = useCallback(() => setSticky(window.scrollY >= SCROLL_THRESHOLD), []);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  // A menu left open while the window grows to desktop width would have nothing to show
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => query.matches && setOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const close = () => setOpen(false);
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-(--z-nav) flex h-20 items-center justify-center px-4">
      <div
        className={cn(
          "flex w-full max-w-6xl items-center justify-between gap-3.5 border transition-all duration-500 lg:gap-6",
          sticky ? "rounded-pill border-border/40 bg-surface/60 p-2.5 shadow-float backdrop-blur-lg" : "border-transparent bg-transparent p-2.5",
        )}
      >
        <Logo />

        <nav aria-label="Marketing" className="hidden rounded-pill bg-surface-sunken p-0.5 md:block">
          <ul className="flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isCurrent(l.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-pill px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface hover:text-text hover:shadow-xs lg:px-4",
                    isCurrent(l.href) && "bg-surface text-text",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {signedIn ? (
              <ArrowButton href="/dashboard" size="md">
                Dashboard
              </ArrowButton>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Sign in</Link>
                </Button>
                <ArrowButton href="/signup" size="md">
                  Get started
                </ArrowButton>
              </>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <Icon name="hamburger-menu" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showClose={false} className="p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex items-center justify-between p-6">
                <Logo />
                <SheetClose asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Close menu">
                    <Icon name="close" size="sm" />
                  </Button>
                </SheetClose>
              </div>

              <div className="flex flex-1 flex-col gap-10 overflow-y-auto px-6 pb-6">
                <nav aria-label="Menu">
                  <ul className="flex flex-col items-start gap-3">
                    {links.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          onClick={close}
                          className={cn(
                            "group/nav flex items-center text-2xl font-medium tracking-tight transition-all",
                            isCurrent(l.href) ? "text-brand" : "text-text-muted hover:translate-x-2 hover:text-text",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-0.5 overflow-hidden bg-brand transition-all duration-300",
                              isCurrent(l.href) ? "mr-2 w-4 opacity-100" : "w-0 opacity-0 group-hover/nav:mr-2 group-hover/nav:w-4 group-hover/nav:opacity-100",
                            )}
                          />
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="flex flex-col items-start gap-4">
                  {signedIn ? (
                    <ArrowButton href="/dashboard" size="lg" onClick={close}>
                      Dashboard
                    </ArrowButton>
                  ) : (
                    <>
                      <ArrowButton href="/signup" size="lg" onClick={close}>
                        Get started
                      </ArrowButton>
                      <Button asChild variant="link-muted" size="bare">
                        <Link href="/login" onClick={close}>
                          Sign in
                        </Link>
                      </Button>
                    </>
                  )}
                </div>

                <p className="mt-auto text-sm text-text-subtle">© {new Date().getFullYear()} Vouchreel</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
