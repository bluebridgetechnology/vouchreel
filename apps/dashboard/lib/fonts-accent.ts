import { Playfair_Display } from "next/font/google";

// Editorial accent face. Italic only, and only imported by the marketing and
// style-guide layouts so the dashboard never downloads it.
export const fontAccent = Playfair_Display({
  subsets: ["latin"],
  style: ["italic"],
  variable: "--font-playfair",
  display: "swap",
});
