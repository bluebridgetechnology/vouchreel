# @vouchreel/video

Remotion templates that turn imported Google and Trustpilot reviews into styled videos, plus the
Node render service the video worker uses.

## Templates

| id | Shows | Reviews | Notes |
| --- | --- | --- | --- |
| `spotlight` | Brand gradient, stars pop in, text types out word by word | 1 | up to 400 characters |
| `minimal` | Light layout, serif italic quote | 1 | up to 400 characters |
| `dark-card` | Dark theme, glowing accent, floating card | 1 | up to 400 characters |
| `stack` | Cards landing on top of each other, "wall of love" | 3 to 5 | up to 240 characters each |
| `rating-spotlight` | Overall rating and review count, then one review | 1 | needs the provider's rating totals |

Each template renders in `9:16` and `16:9`. Video length comes from the text (see `registry.ts`).

## Colours, styles and the `theme` prop

Templates never hard-code colours. They call `derivePalette(brand, { style, secondary })` (`src/lib/palette.ts`),
which builds every colour a template needs from the customer's brand colour:

- **Keep the brand colour.** A light brand colour stays light and gets dark text; a dark one stays dark with
  light text. A colour is only nudged when no text colour can be read on it, and by the smallest amount that works.
- **Text is at least 4.5:1 (WCAG AA)** against the worst point of the background gradient. Accent colours are
  adjusted for the surface they sit on (white card, dark card), never the other way round.
- `secondary` is an optional second colour used as the far end of the gradient (colour styles only).

Six background styles are available on every template (`BACKGROUND_STYLES` / `STYLES` in `src/types.ts` and
`src/registry.ts`, drawn by `components/Backdrop.tsx`):

| style | Look |
| --- | --- |
| `gradient` | Brand colour deepening into a richer shade |
| `solid` | One flat brand colour with soft shapes |
| `aurora` | Blurred glows of the colour drifting around |
| `dots` | Subtle dot pattern over the colour |
| `light` | Paper tinted with the colour |
| `dark` | Near-black with a glow of the colour |

Each template has a `defaultStyle` (`minimal` is `light`, `dark-card` is `dark`, the rest `gradient`).
`ReviewVideoProps` takes an optional `theme: { style?, secondary? }`; with no `style` the template's default is
used (`effectiveStyle()` in `registry.ts` returns what will actually render).

In the dashboard the defaults come from the brand kit (`videoStyle`, `videoSecondaryColor`) and can be overridden
per video with `style` / `secondaryColor` on create.

## Rules the templates follow

- **Reviews are verbatim, or cut and marked.** Templates never reword or reorder review text. A review longer
  than the template's limit (`maxChars`, scaled for the font) is cut by the caller with `shortenReviewText`
  at a whole word, ends with "…", and carries `shortenedFrom` (the full length). `validateProps` still rejects
  text over the limit, so an uncut long review never reaches a template. `SHORTENABLE_SOURCES` in
  `src/lib/shorten.ts` switches cutting off per source: that source's long reviews are then refused as before.
- **Attribution stays on screen:** author name, rating, source name, and the month when known.
- **Source logos are used as supplied.** `src/assets/google-icon.svg` and `src/assets/trustpilot-logo.svg` are
  the company's official files; they are never recoloured, redrawn or stretched (`source-mark.test.ts`
  checks their hashes and proportions). Over a coloured or dark background they sit on a white chip so they
  keep their own colours; on white or light surfaces they are shown directly. The Google icon is shown with
  the text "Google Reviews" (change `SOURCE_LABELS` in `src/types.ts` if the required attribution wording
  differs); the Trustpilot logo already contains its name. Whether these files and this usage satisfy each
  provider's current brand and data-use guidelines is the company's responsibility to confirm.
- **Rating totals are the provider's**, stored at sync time, never computed from a subset.
- Fonts are bundled, so renders are identical everywhere. Non-Latin text falls back to system fonts (the
  Docker image installs Noto). The customer can pick one of six open-licence (SIL OFL) fonts, see
  [Video fonts](#video-fonts); Playfair Display italic stays as Minimal's own quote font.

## Layout of the package

```
src/registry.ts        catalogue, validation, durations. Browser-safe: no Remotion/React imports.
src/types.ts           ReviewVideoProps and friends
src/templates/*.tsx    one component per template; templates/index.ts maps id -> component
src/components/        shared building blocks (stars, word reveal, avatar, badge, layout helpers)
src/lib/               colour helpers, palette derivation (palette.ts), font loading
src/player.tsx         browser preview (Remotion Player), exported as @vouchreel/video/player
src/Root.tsx           registers every template x shape as a Remotion composition
src/render.ts          Node-only render service (bundle once, renderMedia / renderStill)
src/sample.ts          made-up reviews for previews and tests (never shown to customers)
scripts/preview.ts     render preview stills/videos of every template
scripts/bundle.ts      pre-build the compositions (used by the Docker image)
```

## Adding a template

1. Add an entry to `TEMPLATES` in `src/registry.ts` (id, label, review count, `maxChars`, `durationSeconds`).
2. Write the component in `src/templates/` (use `components/primitives.tsx`; design for a 1080px short side
   and multiply by `u` from `useLayout()`).
3. Register it in `src/templates/index.ts` and add sample props in `src/sample.ts`.
4. Add a 360x640 preview to `apps/dashboard/public/video-previews/<id>.jpg` (see "Regenerating template thumbnails").

`src/__tests__/registry.test.ts` fails if a template has no component, or the sample content does not validate.

## Working on templates

```bash
npm run studio -w @vouchreel/video     # Remotion Studio: live preview with sample props
npm run preview -w @vouchreel/video -- --template=stack --aspect=9:16 --times=3,12 --video
```

Add `--style=aurora` (or `--style=all`), `--brand=#0a7d5a`, `--secondary=#1d4ed8` or `--source=trustpilot` to
preview a theme. Stills and videos are written to `packages/video/out/` (git-ignored).

On a machine where Remotion cannot download its own browser (or when running as root), point it at a
headless Chrome and disable the sandbox: `REMOTION_BROWSER_EXECUTABLE=/path/to/headless_shell VIDEO_CHROMIUM_NO_SANDBOX=1`.
Recent full Chrome builds refuse Remotion's headless mode; use the `chrome-headless-shell` binary.

### Regenerating template thumbnails

The template picker shows `apps/dashboard/public/video-previews/<id>.jpg` (360x640). Regenerate them whenever
a template or the palette changes, from a frame where the text has finished revealing (`rating-spotlight`: the
rating intro, around 2.6 s):

```bash
npm run preview -w @vouchreel/video -- --template=minimal --aspect=9:16 --times=9.5
ffmpeg -i packages/video/out/minimal-9x16-t9.5.png -vf scale=360:640:flags=lanczos -q:v 3 apps/dashboard/public/video-previews/minimal.jpg
```

Frames used for the current thumbnails: spotlight, minimal and dark-card 9.5 s, stack 9 s, rating-spotlight 2.6 s.

### Tests

`npm test -w @vouchreel/video` runs the unit tests. `npm run test:render -w @vouchreel/video` additionally renders
the aurora, dots and light styles in real Chromium (slow; skipped by default, not run in CI).

## Video fonts

The list is `VIDEO_FONTS` in `src/lib/font-catalog.ts` (Outfit, Lora, Nunito, Barlow Condensed, JetBrains Mono,
Caveat), chosen from the brand kit or per video as `theme.font`. With no font set, every template looks exactly
as it always did. Each font has three weights (400, 500, 600), bundled in `src/lib/fonts.ts` for renders and
copied with its licence to `apps/dashboard/public/video-fonts` for the browser preview.

A font that runs wider or narrower than Outfit gets a matching type size, and a template's `maxChars` shrinks
for a font that cannot fit as much (JetBrains Mono: 85%). Those numbers are measured, not guessed:
`npm run fonts:measure -w @vouchreel/video` loads the real files in Chromium and prints them (`-- --check` fails
when the committed numbers are stale). Provider attribution ("Google Maps") always stays in the default font.

To add a font: add the `@fontsource` package, an entry in the catalogue, its three imports in `fonts.ts`, the
files and licence in `public/video-fonts`, then run the measure script. The tests fail until each step is done.
Preview every font on every template at its longest allowed review with
`npm run preview -w @vouchreel/video -- --font=lora --fill --end`.

## Live preview in the dashboard

`@vouchreel/video/player` exports `ReviewVideoPreview`, the real composition rendered live by Remotion's `Player`,
so the Brand page and the create dialog show exactly what the render produces. It needs the fonts served from a
public URL (`fontBaseUrl`, the dashboard uses `/video-fonts`, files in `apps/dashboard/public/video-fonts`). It is
browser-only: the server-side renderer never imports it.

## Rendering in production

The video worker (`apps/dashboard/lib/jobs/main-video.ts`) claims `review_video` jobs only; the regular
worker and the cron fallback never do. It needs Chromium, so it runs from the `video-worker` Dockerfile
target (Debian). Environment:

| Variable | Purpose |
| --- | --- |
| `VIDEO_BUNDLE_DIR` | Pre-built compositions (`npm run bundle`). Set in the image. |
| `VIDEO_ENTRY_POINT` | Path to `src/entry.tsx` when the bundle is built at start-up from a bundled worker. |
| `VIDEO_RENDER_CONCURRENCY` | Parallel browser tabs per render (default 2). |
| `WORKER_CONCURRENCY` | Renders at once (default 1). Each needs about 1-2 GB of memory. |
| `REMOTION_BROWSER_EXECUTABLE` | Use a specific Chrome/Chromium instead of Remotion's own download. |

All `remotion` and `@remotion/*` packages must stay on exactly the same version (pinned in `package.json`).

## Licence

Remotion is free for individuals, for-profit companies with up to 3 employees, non-profits and evaluation.
A larger for-profit company needs a paid Company License (<https://www.remotion.dev/docs/license>). Check this
before the team grows.
