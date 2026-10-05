import { loadFont } from "@remotion/fonts";
import outfit400 from "@fontsource/outfit/files/outfit-latin-400-normal.woff2";
import outfit500 from "@fontsource/outfit/files/outfit-latin-500-normal.woff2";
import outfit600 from "@fontsource/outfit/files/outfit-latin-600-normal.woff2";
import playfair500i from "@fontsource/playfair-display/files/playfair-display-latin-500-italic.woff2";

/**
 * Fonts ship inside the package so renders are identical on every machine and never wait on
 * the network. Text outside the Latin range falls back to the system font stack (see theme.ts).
 */
export const fontsReady = Promise.all([
  loadFont({ family: "Outfit", url: outfit400, weight: "400" }),
  loadFont({ family: "Outfit", url: outfit500, weight: "500" }),
  loadFont({ family: "Outfit", url: outfit600, weight: "600" }),
  loadFont({ family: "Playfair Display", url: playfair500i, weight: "500", style: "italic" }),
]);
