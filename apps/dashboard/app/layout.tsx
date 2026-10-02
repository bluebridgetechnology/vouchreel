import "./globals.css";
import type { Metadata } from "next";
import { fontSans, fontMono } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const siteDescription =
  "Collect video testimonials with one link, customize a lightweight widget, and embed social proof anywhere. Contextual matching, smart triggers, and conversion tracking built in.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Vouchreel — Turn customer love into conversions",
    template: "%s · Vouchreel",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: "Vouchreel",
    title: "Vouchreel — Turn customer love into conversions",
    description: siteDescription,
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Vouchreel — Turn customer love into conversions",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
