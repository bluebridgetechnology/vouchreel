import localFont from "next/font/local";

// The app's fonts ship with the app (files in ./fonts, licences beside them) instead of being fetched
// from Google at build time: builds no longer need the network, and visitors' browsers never contact Google.
export const fontSans = localFont({
  src: [
    { path: "./fonts/outfit-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/outfit-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/outfit-latin-500-normal.woff2", weight: "500", style: "normal" }, // max weight is 500; hierarchy comes from size and colour
  ],
  variable: "--font-outfit",
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
