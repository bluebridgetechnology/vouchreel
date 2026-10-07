/**
 * Renders preview stills (and optionally a video) of every template from the sample reviews.
 *   npm run preview -w @vouchreel/video -- [--template=stack] [--aspect=9:16] [--video] [--times=1.5,4,7]
 *     [--font=lora] [--fill] [--end]  (--fill pads each review to the longest the template allows in that font)
 *     [--source=trustpilot] [--brand=#0a7d5a] [--secondary=#1d4ed8] [--style=aurora | --style=all]
 * Output goes to packages/video/out/.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { renderReviewStill, renderReviewVideo } from "../src/render";
import { SAMPLE_PROPS } from "../src/sample";
import { TEMPLATES, durationInFrames, maxCharsFor, type Aspect, type VideoFontId } from "../src/registry";
import { BACKGROUND_STYLES, type BackgroundStyle, type ReviewVideoProps } from "../src/types";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string | undefined]));
const only = args.get("template");
const aspects = (args.get("aspect") ? [args.get("aspect")] : ["9:16", "16:9"]) as Aspect[];
const times = (args.get("times") ?? "1.5,4,7").split(",").map(Number);
const video = args.has("video");
const forcedSource = args.get("source") as "google" | "trustpilot" | undefined;
const brand = args.get("brand");
const secondary = args.get("secondary");
const styleArg = args.get("style");
const font = args.get("font") as VideoFontId | undefined;
const atEnd = args.has("end"); // one still near the end, when the whole text has appeared
const fill = args.has("fill");
// undefined = the template's own default style
const styles: (BackgroundStyle | undefined)[] = styleArg === "all" ? [...BACKGROUND_STYLES] : styleArg ? [styleArg as BackgroundStyle] : [undefined];

const out = path.resolve(import.meta.dirname, "../out");
mkdirSync(out, { recursive: true });

for (const template of TEMPLATES.filter((t) => !only || t.id === only)) {
  const sample = SAMPLE_PROPS[template.id];
  // --source shows every review (and the rating totals) as coming from one provider
  const withSource: ReviewVideoProps = forcedSource
    ? { ...sample, reviews: sample.reviews.map((r) => ({ ...r, source: forcedSource })), ...(sample.aggregate ? { aggregate: { ...sample.aggregate, source: forcedSource } } : {}) }
    : sample;
  // --fill: every review as long as the template allows in this font, cut at a word, to see the worst case
  const filledSource: ReviewVideoProps = fill
    ? {
        ...withSource,
        reviews: withSource.reviews.map((r) => {
          const limit = maxCharsFor(template.maxChars, font);
          let text = r.text;
          while (text.length < limit) text += ` ${r.text}`;
          text = text.slice(0, limit);
          return { ...r, text: text.slice(0, Math.max(text.lastIndexOf(" "), 12)).trimEnd().replace(/[,;:]$/, "") + "." };
        }),
      }
    : withSource;
  const seconds = durationInFrames(template.id, filledSource) / 30;

  for (const style of styles) {
    const props: ReviewVideoProps = {
      ...filledSource,
      ...(brand ? { brand } : {}),
      ...(style || secondary || font ? { theme: { ...(style ? { style } : {}), ...(secondary ? { secondary } : {}), ...(font ? { font } : {}) } } : {}),
    };
    const suffix = [font, fill ? "fill" : undefined, forcedSource, brand?.replace("#", ""), secondary ? `2nd${secondary.replace("#", "")}` : undefined, style].filter(Boolean).join("-");

    for (const aspect of aspects) {
      const base = `${template.id}-${aspect.replace(":", "x")}${suffix ? `-${suffix}` : ""}`;
      for (const t of atEnd ? [Math.max(0, seconds - 2.2)] : times) {
        if (t >= seconds) continue;
        await renderReviewStill({ templateId: template.id, aspect, props, outputPath: path.join(out, `${base}-t${t}.png`), frame: Math.round(t * 30) });
      }
      if (video) {
        const started = Date.now();
        await renderReviewVideo({ templateId: template.id, aspect, props, outputPath: path.join(out, `${base}.mp4`) });
        console.log(`${base}: ${seconds.toFixed(1)}s video rendered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
      }
      console.log(`${base}: stills done (${seconds.toFixed(1)}s long)`);
    }
  }
}
process.exit(0);
