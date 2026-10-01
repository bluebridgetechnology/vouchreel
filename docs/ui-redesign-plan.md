# Vouchreel UI Redesign: Audit and Implementation Plan

Scope: `apps/dashboard` (Next.js, Tailwind v4, 67 TSX files) plus `packages/widget` (embeddable shadow-DOM widget).

## 1. Audit findings

### 1.1 Is all styling sourced from global CSS? No.

`app/globals.css` defines a shadcn-default neutral token set (`--background`, `--primary`, ...), all pure grayscale. There is no brand colour, so the app has no identity. Components bypass even this thin layer:

| Issue | Count | Where |
|---|---|---|
| Raw Tailwind palette classes (`emerald-*`, `amber-*`, `blue-*`, `white`, `black`, `red-*`, `purple-*`, `zinc-*` ...) | **432** | worst: `widget/live-preview.tsx` (36), `experiments/experiments-view.tsx` (30), `social/page.tsx` (17), `reviews/page.tsx` (13), `analytics-dashboard.tsx` (10) |
| `emerald-*` alone | 165 | used as de facto "success/brand" colour, never defined as a token |
| Hex literals in TSX | ~40 | `#7c3aed` (collect form), `#6366f1` (social/time-series/OG image), `#16a34a` (chart), Google/Trustpilot brand SVGs (legitimate), theme presets |
| Hardcoded hex in API routes and widget defaults | several | `#4f46e5` report route, `#6366f1` social settings route |
| `rgba()` literals | 28 | `opengraph-image.tsx` gradients |
| Inline `style={{}}` | 32 | most are dynamic user-brand colour (legit); some are static gradients (`social/page.tsx:384`) |
| Arbitrary type sizes `text-[7px..11px]` | **~200** (`text-[11px]` 89, `[10px]` 76, `[9px]` 18, `[8px]` 13, `[7px]` 6) | no scale: sub-12px text is the norm |
| Widget CSS (`packages/widget/src/styles.css`, 943 lines) | 30 hex literals, system font stack | separate world; correct to be isolated but values are not derived from the same source |
| Fonts | Geist via `next/font/local`, wired through `--font-geist-*` | no display face, no type scale tokens; replaced by Outfit + Playfair + JetBrains Mono |

### 1.2 Is a design token system strictly followed? No.

- **Only colour tokens exist.** No tokens for: type scale, font weight roles, line-height, letter-spacing, spacing, radius usage rules, shadows/elevation, motion, z-index, status colours (success/warning/info), brand colours, surface levels.
- **Radius**: 6 variants in use (`rounded` 98, `rounded-md` 201, `rounded-lg` 161, `rounded-xl` 99, `rounded-2xl` 31, `rounded-full` 112) with no rule for which applies where.
- **Shadows**: `shadow-xs/sm/shadow/md/lg/xl/2xl` all used ad hoc (170 uses).
- **Weights**: `font-medium` 234, `font-semibold` 229, `font-bold` 166, `font-extrabold` 9, `font-black` 1; same role gets different weights in different files.
- **No component primitives.** `components/ui/` does not exist despite `components.json` pointing at it. `cva` is not installed. Result: ~190 `<button>` and countless `<input>` classNames copy-pasted with drift. Example: primary button recipe appears in 8+ different class strings (`h-10 rounded-md`, `rounded-lg py-2.5`, `rounded px-4 py-1.5`, `px-5 py-2 text-xs shadow` ...). Input focus style has 4+ variants.
- **Icons**: 29 files embed raw inline `<svg>` paths (e.g. `dashboard-sidebar.tsx`) although `components.json` declares `lucide` (never installed). Decision: **Solar Outline** via Iconify, bundled offline.
- **Dark mode is half-built**: `.dark` tokens and `dark:` variants (19 files) exist, but there is no theme provider or toggle, and `dark:` variants hardcode palette shades (`text-emerald-400`, `bg-blue-950`) so they cannot follow a token change.
- **Primary is near-black** (`0 0% 9%`): every `bg-primary` button (192 uses) is black. That is the "generic shadcn" look the user wants to avoid.
- Dead config: `tailwind.config.ts` is empty and ignored by Tailwind v4 (no `@config`). Harmless but misleading.

### 1.3 Why it reads as "AI slop" today

Neutral grayscale only; every page is dense `text-xs` gray; all cards identical `rounded-lg border`; no hierarchy of surface; no illustration/colour moments; inconsistent control sizing; marketing page (393 lines) uses same primitives as the admin app.

## 2. Target design direction (from the two references)

Both refs share one language. Adopt it:

- **Canvas**: warm white / very light cool-warm grey page, white cards floating on it. Not pure `#fff` everywhere; use a surface ladder (canvas, surface, raised).
- **One confident accent**: warm coral/orange (Qtask coral-red, Earnify orange). Recommended single brand hue, orange-coral (~`hsl(14 90% 58%)`), used for primary CTAs, active states, key data. Near-black ink for text and secondary (black pill) buttons.
- **Soft pastel tint panels** for feature blocks and data tiles: pink, lime/chartreuse, peach, cream. These are *tints of the semantic palette*, not new random colours.
- **Dark brown/ink band** for testimonial/proof sections (Earnify), a natural fit for a testimonial product.
- **Shape**: large radii (cards 20-28px, pills for buttons/badges/tabs), hairline borders, very soft shadows. Generous whitespace; 12-col grid, max width ~1200.
- **Type**: big, tight-tracked display headings (clamp 40-72px, weight 500-600, `-0.03em`), small muted body, tiny uppercase eyebrow pills ("HIGH EFFICIENT", "USE CASES"). Fonts (decided): **Outfit** for everything, including all headlines (`--font-sans`). **Playfair Display Italic** only, as a sparing emphasis accent: one or two words inside a marketing headline or pull-quote (`--font-accent`, a `.accent-italic` utility / `<Em>` component; italic file only, no upright Playfair). Marketing routes only, never in the dashboard. **JetBrains Mono** for code, keys, snippets and chart axis labels (`--font-mono`). KPI numbers use Outfit with `tabular-nums`. All via `next/font/google`, variable, `display: swap`; Playfair italic loaded on marketing routes only. Geist removed.
- **Product shots as hero**: real UI cards (progress bars, activity chart, review cards) composed on pastel backdrops instead of stock icons.
- **Anti-slop rules**: no purple/indigo gradients, no emoji icons, no glassmorphism blobs, no centred-everything, no identical 3-column icon-card grids without content hierarchy, no `text-[10px]` body copy.

Decision for the user: confirm accent (orange-coral recommended) before Phase 1 starts. Everything else is a token swap afterwards.

## 2.1 Decisions (confirmed)

- Accent: orange-coral (~`hsl(14 90% 58%)`).
- Dark mode ships in the first pass: every token has light and dark values from Phase 1, every phase is verified in both themes.
- Fonts: Outfit (all text and headlines), Playfair Display Italic (emphasis only), JetBrains Mono (code/charts).
- Icons: Solar Outline via offline Iconify.

## 3. Token architecture (the contract)

All in `app/globals.css`, three layers, Tailwind v4 `@theme`. **Rule: components reference only layer 3 (semantic) names.** No hex, no `rgb/hsl` literal, no raw palette class, no arbitrary `text-[Npx]`.

**Layer 1: primitives** (`--palette-*`): coral 50-950, ink/neutral warm 50-950, pink, lime, peach, sky, green, amber, red scales. Stored as OKLCH (better tint ramps and consistent contrast) instead of `hsl(var(--x))` triplets.

**Layer 2: semantic** (theme-switchable via `:root` and `.dark`):
- Surfaces: `--canvas`, `--surface`, `--surface-raised`, `--surface-sunken`, `--surface-inverse`
- Text: `--text`, `--text-muted`, `--text-subtle`, `--text-inverse`, `--text-on-accent`
- Borders: `--border`, `--border-strong`, `--ring`
- Brand: `--brand`, `--brand-hover`, `--brand-soft`, `--brand-foreground`
- Status: `--success`, `--warning`, `--info`, `--danger`, each with `-soft` (tint bg) and `-foreground` variants. Replaces the 165 emerald, 57 amber, 44 blue uses.
- Tints for panels: `--tint-pink`, `--tint-lime`, `--tint-peach`, `--tint-cream`
- Data viz: `--chart-1..6` (colour-blind safe), mapped to `--color-chart-*`
- Keep shadcn alias names (`--primary`, `--card`, `--muted`...) mapped onto these so existing code keeps working during migration, then retire.

**Layer 3: Tailwind theme mappings** (`@theme inline`): `--color-*` for every semantic token, plus:
- **Type scale** `--text-2xs..--text-display` with paired line-height/tracking (`--text-xs--line-height`), minimum body size 12px (kills all 200 arbitrary sub-12px sizes; where tiny labels are truly needed, one `--text-2xs: 11px` token)
- **Weights**: Outfit max weight is **500**; only 300 / 400 / 500 are loaded. Hierarchy comes from size, colour and spacing, never from bold. Legacy `font-semibold/bold/extrabold/black` utilities are clamped to 500 in the theme until migrated, then banned.
- **Radius**: `--radius-control` (10px), `--radius-card` (20px), `--radius-panel` (28px), `--radius-pill`. Map to `rounded-control/card/panel/pill`; ban bare `rounded`, `rounded-md/lg/xl/2xl`.
- **Shadows**: `--shadow-xs`, `--shadow-card`, `--shadow-float`, `--shadow-focus` (3 levels + focus ring).
- **Spacing**: stay on Tailwind 4px scale; add `--space-section` (clamp) and `--container-page`.
- **Motion**: `--ease-out`, `--duration-fast/base/slow`; honour `prefers-reduced-motion`.
- **z-index** scale: `--z-nav`, `--z-dropdown`, `--z-modal`, `--z-toast`.
- **Fonts**: `--font-sans`, `--font-accent`, `--font-mono`.

**User-brand colours** (collect form accent, widget theme, social brandColor): these are *data*, not design tokens. Keep as runtime inline `style` but through a single CSS custom property (`style={{"--user-accent": accent}}` + `bg-[--user-accent]`) via one helper, with a default read from `--brand`. Server-side defaults (`#6366f1`, `#4f46e5`, `#7c3aed`) move to one shared constant `DEFAULT_BRAND_HEX` in `lib/brand.ts` that mirrors the token (one place to change, tested by a unit test that compares it to globals.css).

**Widget** (`packages/widget`): shadow DOM cannot inherit app tokens. Generate `--vr-*` defaults from the same token source at build time (small script emits `widget-tokens.css` from the primitive/semantic values), replace 30 hex literals with `var(--vr-*)`, system font stack stays (host-page safe).

## 4. Enforcement (so it stays clean)

1. ESLint custom rule or `eslint-plugin-tailwindcss`/`no-restricted-syntax` regex rules failing CI on: raw palette classes, `#hex` / `rgb()` / `hsl()` in `.tsx` (allowlist: brand SVG logos, OG image, tests), `text-[Npx]`, bare legacy radius classes, `style={{ color|background }}` with literals.
2. Stylelint-style check script `scripts/check-tokens.mjs` run in `npm run lint` that greps counts and fails if > 0 (baseline numbers from this audit are the starting ratchet).
3. `/design` route (dev-only) rendering every token and primitive: the living style guide and the visual regression target.
4. PR checklist item in `AGENT.md`: "UI uses tokens/primitives only".

## 5. Component primitives (`components/ui`)

Install `class-variance-authority`, `@iconify/react` + `@iconify-json/solar` (offline icon data, no runtime API fetch; only `solar:*-outline` names; single `<Icon name size />` wrapper), `@radix-ui/*` (as needed), `next-themes`. Build, each token-only with `cva` variants:

- `Button` (primary coral, dark/ink, outline, soft, ghost, destructive; sizes sm/md/lg; pill shape; loading state)
- `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `Field` (label + hint + error)
- `Card` (+ `Card.Tint` pastel variants), `Badge`/`Pill` (status + eyebrow), `Tabs` (pill style, replaces `space-nav-tabs`), `Dialog`, `Dropdown`, `Tooltip`, `Toast`
- `Table`, `EmptyState`, `Skeleton`, `Progress`, `Stat` (KPI tile), `Avatar`
- `PageHeader`, `Section`, `Container`
- Chart theme wrapper for recharts reading `--chart-*` (replaces hardcoded `stroke="#6366f1"`).
- Theme provider + toggle (`next-themes`, class strategy) so dark mode becomes real.
- Replace 29 inline-SVG icon files with the `<Icon>` wrapper (Solar Outline); update `components.json` `iconLibrary`.

## 6. Phased implementation

Each phase ships independently, `npm run build` + tests green, branch per phase.

**Phase 0: Decisions + baseline (0.5 day)**
Decisions confirmed (section 2.1). Capture baseline screenshots of every route (Playwright script) and the audit counts as the lint ratchet.

**Phase 1: Foundation (1-1.5 days)**
Rewrite `globals.css` with layers 1-3 above; keep shadcn alias names pointing at new values so nothing breaks. Fonts/display token. Delete dead `tailwind.config.ts`. Theme provider. Build `/design` style-guide page. Result: whole app already re-skins (black buttons become coral) with zero component edits.

**Phase 2: Primitives (2 days)**
Build `components/ui/*` per section 5 with the style guide as the test bed. Add `lib/brand.ts`.

**Phase 3: Marketing site (2 days)**
`(marketing)/page.tsx`, pricing, header/footer, checkout, OG image. Follow reference layout: centred display hero + dual CTA, product-card cluster on pastel tiles, logo/proof strip, 6-up workflow cards, alternating feature rows with eyebrow pills, dark testimonial band, final CTA, rich footer with newsletter. Real product mockups built from primitives.

**Phase 4: App shell + auth (1.5 days)**
Sidebar (Solar Outline icons, active pill, workspace switcher), top bar, `(auth)` screens, onboarding, `PageHeader`/`Section` layout, loading/empty states.

**Phase 5: Dashboard screens migration (3-4 days, by worst offender)**
Order: `spaces`, `testimonials`, `widget` (`live-preview.tsx` + `theme-editor`), `experiments-view`, `analytics-dashboard` + charts, `reviews`, `social`, `collect`, `settings/*`, `agency`, `admin`, `billing`. Per file: swap controls for primitives, raw colours to status tokens (emerald to `success`, amber to `warning`, blue to `info`), `text-[Npx]` to scale tokens, radius/shadow to named tokens. Public `/collect/[slug]` page gets user-accent via the single custom property.

**Phase 6: Widget + emails (1 day)**
Token-generated widget CSS, hex removal; align transactional email templates in `lib/email` to brand tokens (inline hex required in email; sourced from one `emailTheme` constant).

**Phase 7: Enforcement + QA (1 day)**
Turn lint rules on as errors, remove shadcn alias layer, a11y pass (contrast >= 4.5:1 for every semantic pair, focus rings, 44px touch targets), responsive pass at 375/768/1280, reduced-motion, dark-mode pass, before/after screenshots.

Total estimate: ~12-14 working days.

## 7. Definition of done

- `grep` for raw palette classes, hex/rgb/hsl literals (excluding allowlist), `text-[Npx]`, legacy radius: **0**.
- Changing `--brand` in `globals.css` re-skins the entire app, marketing, widget defaults and OG image with no other edit.
- Every control comes from `components/ui`; no page defines its own button/input classes.
- Light and dark both pass WCAG AA.
- `/design` style guide documents every token and primitive.

## 8. Risks

- Largest files (`live-preview.tsx`, `experiments-view.tsx`, `analytics-dashboard.tsx`) are tightly styled; migrate with screenshot diffs.
- User-supplied brand colours may fail contrast on `--text-on-accent`; compute readable foreground at runtime (small luminance helper).
- Widget is a public embed: token changes must stay backward-compatible with saved `theme` configs.
- Next/React/Tailwind versions are `latest`; pin before the migration to avoid churn mid-redesign.
