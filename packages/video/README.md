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

## Rules the templates follow

- **Reviews are verbatim.** Templates never shorten, reword or reorder review text. A review that
  does not fit a template is rejected (`validateProps`), not trimmed. Long text only gets a smaller font.
- **Attribution stays on screen:** author name, rating, source name, and the month when known.
- **No provider logos.** Sources are shown as a text badge (Google / Trustpilot brand rules).
- **Rating totals are the provider's**, stored at sync time, never computed from a subset.
- Fonts (Outfit, Playfair Display) are bundled, so renders are identical everywhere. Non-Latin text
  falls back to system fonts (the Docker image installs Noto).

## Layout of the package

```
src/registry.ts        catalogue, validation, durations. Browser-safe: no Remotion/React imports.
src/types.ts           ReviewVideoProps and friends
src/templates/*.tsx    one component per template; templates/index.ts maps id -> component
src/components/        shared building blocks (stars, word reveal, avatar, badge, layout helpers)
src/lib/               colour helpers, font loading
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
4. Add a 360x640 preview to `apps/dashboard/public/video-previews/<id>.jpg`.

`src/__tests__/registry.test.ts` fails if a template has no component, or the sample content does not validate.

## Working on templates

```bash
npm run studio -w @vouchreel/video     # Remotion Studio: live preview with sample props
npm run preview -w @vouchreel/video -- --template=stack --aspect=9:16 --times=3,12 --video
```

Stills and videos are written to `packages/video/out/` (git-ignored).

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
