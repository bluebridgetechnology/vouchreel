import "./globals.css";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { fontSans, fontHeading, fontMono } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { CookieNotice } from "@/components/cookie-notice";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { ConfirmProvider } from "@/components/ui/confirm";
import { NavigationProgress } from "@/components/navigation-progress";
import { TooltipProvider } from "@/components/ui/tooltip";


export const metadata: Metadata = {
  applicationName: SITE_NAME,
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vouchreel — Turn customer love into conversions",
    template: "%s · Vouchreel",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Vouchreel",
    title: "Vouchreel — Turn customer love into conversions",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vouchreel — Turn customer love into conversions",
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The nonce made for this request by proxy.ts, for the one inline script we ship (the theme). This makes pages
  // render per request, which a nonce requires; CSP_MODE=off in the environment switches the policy off.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider nonce={nonce}>
          <TooltipProvider delayDuration={200}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </TooltipProvider>
          <NavigationProgress />
          <Toaster />
          <CookieNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
