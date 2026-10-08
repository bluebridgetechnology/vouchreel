"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import "@/lib/zod-no-eval";

export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
