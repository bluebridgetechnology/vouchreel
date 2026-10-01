import { Outfit, JetBrains_Mono } from "next/font/google";

export const fontSans = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500"], // max weight is 500; hierarchy comes from size and colour
  variable: "--font-outfit",
  display: "swap",
});

// Mono is only used for code snippets, keys and chart labels, so it is not
// preloaded on every page.
export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});
