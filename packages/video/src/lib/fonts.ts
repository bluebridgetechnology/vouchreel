import { loadFont } from "@remotion/fonts";
import outfit400 from "@fontsource/outfit/files/outfit-latin-400-normal.woff2";
import outfit500 from "@fontsource/outfit/files/outfit-latin-500-normal.woff2";
import outfit600 from "@fontsource/outfit/files/outfit-latin-600-normal.woff2";
import lora400 from "@fontsource/lora/files/lora-latin-400-normal.woff2";
import lora500 from "@fontsource/lora/files/lora-latin-500-normal.woff2";
import lora600 from "@fontsource/lora/files/lora-latin-600-normal.woff2";
import nunito400 from "@fontsource/nunito/files/nunito-latin-400-normal.woff2";
import nunito500 from "@fontsource/nunito/files/nunito-latin-500-normal.woff2";
import nunito600 from "@fontsource/nunito/files/nunito-latin-600-normal.woff2";
import barlowCondensed400 from "@fontsource/barlow-condensed/files/barlow-condensed-latin-400-normal.woff2";
import barlowCondensed500 from "@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2";
import barlowCondensed600 from "@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2";
import jetbrainsMono400 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2";
import jetbrainsMono500 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2";
import jetbrainsMono600 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2";
import caveat400 from "@fontsource/caveat/files/caveat-latin-400-normal.woff2";
import caveat500 from "@fontsource/caveat/files/caveat-latin-500-normal.woff2";
import caveat600 from "@fontsource/caveat/files/caveat-latin-600-normal.woff2";
import playfair500i from "@fontsource/playfair-display/files/playfair-display-latin-500-italic.woff2";

/**
 * Fonts ship inside the package so renders are identical on every machine and never wait on
 * the network. The catalogue is in lib/font-catalog.ts; every family there is loaded here.
 * Text outside the Latin range falls back to the system font stack (see theme.ts).
 */
export const fontsReady = Promise.all([
  loadFont({ family: "Outfit", url: outfit400, weight: "400" }),
  loadFont({ family: "Outfit", url: outfit500, weight: "500" }),
  loadFont({ family: "Outfit", url: outfit600, weight: "600" }),
  loadFont({ family: "Lora", url: lora400, weight: "400" }),
  loadFont({ family: "Lora", url: lora500, weight: "500" }),
  loadFont({ family: "Lora", url: lora600, weight: "600" }),
  loadFont({ family: "Nunito", url: nunito400, weight: "400" }),
  loadFont({ family: "Nunito", url: nunito500, weight: "500" }),
  loadFont({ family: "Nunito", url: nunito600, weight: "600" }),
  loadFont({ family: "Barlow Condensed", url: barlowCondensed400, weight: "400" }),
  loadFont({ family: "Barlow Condensed", url: barlowCondensed500, weight: "500" }),
  loadFont({ family: "Barlow Condensed", url: barlowCondensed600, weight: "600" }),
  loadFont({ family: "JetBrains Mono", url: jetbrainsMono400, weight: "400" }),
  loadFont({ family: "JetBrains Mono", url: jetbrainsMono500, weight: "500" }),
  loadFont({ family: "JetBrains Mono", url: jetbrainsMono600, weight: "600" }),
  loadFont({ family: "Caveat", url: caveat400, weight: "400" }),
  loadFont({ family: "Caveat", url: caveat500, weight: "500" }),
  loadFont({ family: "Caveat", url: caveat600, weight: "600" }),
  loadFont({ family: "Playfair Display", url: playfair500i, weight: "500", style: "italic" }),
]);
