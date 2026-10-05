/**
 * Renders preview stills (and optionally a video) of every template from the sample reviews.
 *   npm run preview -w @vouchreel/video -- [--template=stack] [--aspect=9:16] [--video] [--times=1.5,4,7]
 *     [--source=trustpilot] [--brand=#0a7d5a] [--secondary=#1d4ed8] [--style=aurora | --style=all]
 * Output goes to packages/video/out/.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { renderReviewStill, renderReviewVideo } from "../src/render";
import { SAMPLE_PROPS } from "../src/sample";
import { TEMPLATES, durationInFrames, type Aspect } from "../src/registry";
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
  const seconds = durationInFrames(template.id, withSource) / 30;

  for (const style of styles) {
    const props: ReviewVideoProps = {
      ...withSource,
      ...(brand ? { brand } : {}),
      ...(style || secondary ? { theme: { ...(style ? { style } : {}), ...(secondary ? { secondary } : {}) } } : {}),
    };
    const suffix = [forcedSource, brand?.replace("#", ""), secondary ? `2nd${secondary.replace("#", "")}` : undefined, style].filter(Boolean).join("-");

    for (const aspect of aspects) {
      const base = `${template.id}-${aspect.replace(":", "x")}${suffix ? `-${suffix}` : ""}`;
      for (const t of times) {
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
