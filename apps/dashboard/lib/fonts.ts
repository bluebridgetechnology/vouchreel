import localFont from "next/font/local";

// The app's fonts ship with the app (files in ./fonts, licences beside them) instead of being fetched
// from Google at build time: builds no longer need the network, and visitors' browsers never contact Google.

// Body, labels, buttons and inputs.
export const fontSans = localFont({
  src: [
    { path: "./fonts/inter-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" }, // max weight is 500; hierarchy comes from size and colour
  ],
  variable: "--font-inter",
  display: "swap",
});

// Headings and titles. Same 300/400/500 ceiling as the body font.
export const fontHeading = localFont({
  src: [
    { path: "./fonts/urbanist-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/urbanist-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/urbanist-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-urbanist",
  display: "swap",
});

// Mono is only used for code snippets, keys and chart labels, so it is not
// preloaded on every page.
export const fontMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});
