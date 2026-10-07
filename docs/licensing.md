# Third-party licences that need a decision

## Remotion (video rendering)

Remotion renders every review video and social export. It is not open source in the usual sense: its
licence (`node_modules/remotion/LICENSE.md`, read on 2026-10-07 for the installed version) says:

- **Free**, including commercial use, for an individual, a for-profit organisation **with up to 3
  employees**, a non-profit, or someone still evaluating it.
- **A paid Company License is required** for any other for-profit organisation. Pricing and purchase:
  https://www.remotion.pro/license
- It may be used to make videos and images, and modified for your own use. It may not be copied or
  modified to sell, rent or license your own derivative of Remotion.
- The licence says its terms **change in Remotion 5.0**.

**What this means for Vouchreel.** Using it to render customers' videos on the hosted product is a use for
making videos, so that is covered. Whether it is *free* depends on the size of the company running the
product, which this repository cannot know. Before the company has more than 3 employees (or takes on
outside paying customers at a scale where it counts as more than a small business), buy the Company
License. The person to decide is whoever owns the company's finances.

**Guard against a silent change.** `packages/video/src/__tests__/license.test.ts` fails if the installed
licence no longer says "up to 3 employees" and "Company License". It will fail when Remotion is upgraded
to a version with new terms (5.0 announces them), which is the moment to read the new licence before
shipping the upgrade.

## Third-party review sources (Google, Trustpilot)

Decision (2026-10-07): reviews are pulled, turned into a video, attributed and saved, as built. The platforms' own
terms on storing and re-displaying reviews were not checked against their current text (their pages were not
reachable from the build environment), and the risk was accepted by the owner. Revisit if a platform objects, or
before a large launch. Reviews the owner types in themselves (provider `own`) involve no third party.

## Video fonts

The fonts review videos can use (Outfit, Lora, Nunito, Barlow Condensed, JetBrains Mono, Caveat, plus Playfair
Display for Minimal's quote) are under the SIL Open Font License 1.1, which allows bundling, embedding in videos
and commercial use, and forbids selling the font files on their own. Each is installed from its `@fontsource`
package and shipped with its licence text next to the files (`apps/dashboard/public/video-fonts/LICENSE-*.txt`);
a test fails if a font in the list has no licence file. Videos made with them are the customer's, as the
licence's embedding clause says. Customers cannot upload fonts, so no font of unknown licence can enter.

## Other things worth knowing

- FFmpeg is called as a separate program on the server (not linked into the app). Its own licence applies to
  the build you install; the Docker images use Debian's package.
- Chromium is used by Remotion for rendering and is under its own permissive licence.
