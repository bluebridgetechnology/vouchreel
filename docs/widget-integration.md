# Widget Integration Guide

This guide is for site owners who want to display VouchReel video testimonials on their website. No coding experience required for the standard platforms — you copy one line and paste it into your site.

---

## How it works

You paste a single `<script>` tag into your site. That script:

1. Loads a tiny (~15 KB) loader from the VouchReel app or your CDN.
2. Fetches your space's widget configuration and testimonials from the VouchReel API.
3. Renders the widget inside an isolated Shadow DOM container, so your site's CSS can never break it and the widget can never break your site's CSS.
4. Records anonymous view/click/play events for the analytics dashboard.

The widget is designed to **fail silently**: if the API is unreachable, your space was deleted, or the script is blocked, your site keeps working exactly as before — no errors, no layout shift.

---

## Step 1 — Get your embed code

1. Log in to the VouchReel dashboard.
2. Open your space → **Widget** tab.
3. Copy the script snippet. It looks like this:

```html
<script async src="https://your-vouchreel-domain.com/widget/YOUR_EMBED_KEY.js"></script>
```

Each space has its own embed key (for example `seed-analytics-space`). The key determines which testimonials and settings the widget shows, so you can use different snippets for different spaces, or the same snippet site-wide.

## Step 2 — Paste it into your site

Pick your platform below.

### Standard HTML

Paste the snippet just before your closing `</body>` tag (or in `<head>`). It loads asynchronously and will not slow down your page.

```html
<body>
  <!-- your page content -->

  <script async src="https://your-vouchreel-domain.com/widget/YOUR_EMBED_KEY.js"></script>
</body>
```

### WordPress

1. **Official Plugin**: Install our [WordPress Plugin](integrations/wordpress.md) for automated footer injection and Gutenberg block support.
2. **Manual / WPCode**: In WP Admin, go to **Code Snippets → Header & Footer**, and paste the snippet into the **Footer** box.
3. See the full [WordPress Integration Guide](integrations/wordpress.md).

### Shopify

1. In Shopify Admin, go to **Online Store → Themes**.
2. Click **...** next to your active theme → **Edit code**.
3. Under **Layout**, open `theme.liquid`.
4. Paste the snippet right before `</body>`.
5. For dynamic product-level matching and Shopify 2.0 blocks, see the [Shopify Integration Guide](integrations/shopify.md).

### Webflow

1. Open **Project Settings → Custom Code**.
2. Paste the snippet into the **Footer Code** area.
3. Save and **republish** your site.
4. For CMS collections and custom embeds, see the [Webflow Integration Guide](integrations/webflow.md).

### Framer

1. In Framer, open **Project Settings → General → Custom Code**.
2. Paste the snippet into the End of `<body>` section.
3. For drag-and-drop React code components, see the [Framer Integration Guide](integrations/framer.md).

### Next.js / React

Use the `Script` component so the widget loads after hydration:

```tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          async
          strategy="afterInteractive"
          src="https://your-vouchreel-domain.com/widget/YOUR_EMBED_KEY.js"
        />
      </body>
    </html>
  );
}
```

### Other builders (Squarespace, Wix, …)

Any platform that allows custom code in the site footer works. Look for "Custom Code", "Footer Code", or "Embed" settings and paste the snippet there.

## Step 3 — Verify

Publish your site and open a page in a browser:

- The widget appears once its trigger fires (see [Trigger types](#trigger-types)).
- Open the dashboard → **Analytics** tab: views should start appearing within a minute.

In the dashboard, the **Install** step of a widget (and the install help on the Widgets page) has an **Is it on your site?** panel:

- **Last seen** lists the sites where a visitor really saw the widget in the last 30 days (host only, never the page path). This is the surest proof.
- **Check a page** loads an address you give and looks for your script (and, for a widget that sits in the page, its spot). It reads only the HTML the server sends, so a script added by JavaScript or a tag manager can show as "not found" while working: check **Last seen** after visiting the page yourself.

If nothing appears, see [Troubleshooting](#troubleshooting).

---

## Trigger types

The widget does not have to appear immediately. Configure this per widget in the dashboard (**Widgets** tab):

| Trigger | Behavior |
| --- | --- |
| **Delay** | Appears after N seconds on the page. |
| **Exit intent** | Desktop: appears when the cursor leaves the top of the viewport. Mobile: appears on a rapid scroll-up flick. |
| **Scroll depth** | Appears after the visitor scrolls N% of the page. |
| **Pageview count** | Appears on the visitor's Nth page in the session. |
| **Returning visitor** | Appears only to visitors who have been to your site before. |

Once a visitor dismisses the widget, it stays dismissed for the rest of their browser session (reopening a new tab or the next day re-arms it).

## Page targeting

By default the widget shows on **all pages** (`*`). In the dashboard you can restrict it with glob patterns:

| Pattern | Matches |
| --- | --- |
| `*` | Every page |
| `/pricing` | Exactly `/pricing` |
| `/blog/*` | One segment under `/blog` — `/blog/post-1`, not `/blog/2026/post-1` |
| `/blog/**` | Any path under `/blog`, including nested ones |

`pagesIncluded` is checked first, then `pagesExcluded` — a page must match an include and must not match any exclude.

## Several widgets on one site

A space can have several widgets (the number depends on your plan): for example a floating card on every page and a wall of love on one page. Each widget has its own layout, look, trigger and page targeting, is switched on or off on its own, and a new one stays off until you publish it.

**One script serves all of them**: add the script tag once to each page, as in Step 2. Then:

- A widget that floats in a corner (floating card, video bubble, video reel, story strip) needs nothing else.
- A widget that sits in your page (carousel, wall of love, masonry, reel feed, spotlight, rating badge, marquee) needs a spot. Open the widget in the dashboard, go to its **Install** step and copy its spot, which looks like `<div data-vouchreel-widget="WIDGET_ID"></div>`, to where it should appear. Pages that already use `<div data-vouchreel-embed></div>` keep working for your first widget.
- An inline widget with no spot on a page is simply not shown there.

Closing one widget does not close the others, and a visitor's page-view count is counted once per page however many widgets use it. The **Widgets** tab shows each widget's views and plays for the last 30 days, and **Analytics** can be filtered to one widget once a space has more than one.

## Videos made by Vouchreel in the widget

Videos made from your Google and Trustpilot reviews, and AI-narrated videos made from your testimonials, can be shown in the widget. Each one has a **Show in my widget** switch next to its download button (off until you turn it on). A video shows up as an ordinary video card, labelled "Review video" or "AI-generated video", in the card-based layouts (Wall of Love, Carousel, Masonry); the other layouts show it without a picture.

A video stops being shown when you turn the switch off, delete it, our team removes it, its AI consent is withdrawn, or its testimonial is hidden. The video file is deleted at the same time, and a card whose file has gone drops itself when a page loads. A visitor who already had the page open keeps the card until they reload, but playing it fails because the file is gone. Pages that include videos are cached for one minute at the edge (five minutes otherwise), so the list catches up quickly.

## Conversion tracking

You can record conversions (e.g. a purchase or signup) from your own site. Enable goals in the dashboard (**Analytics → Conversion goals**) and note the goal ID, then fire:

```html
<script>
  window.vouchreelConvert && window.vouchreelConvert("YOUR_GOAL_ID");
</script>
```

Call it wherever your conversion happens (order confirmation page, signup success handler, or your analytics tool's event callback). The call is safe to make even before the widget has loaded — the `&&` guard prevents errors. Conversions appear in the dashboard's funnel and analytics views.

## Self-hosting the widget script

By default the snippet points at the VouchReel app, which serves the script at `/widget/<key>.js` for every key. At higher traffic you may want to put the script on a CDN — see [Widget CDN deployment](deployment.md#widget-cdn-deployment). Nothing else changes: the script discovers its API backend from its own origin, or you can point it elsewhere explicitly with `data-api`:

```html
<script async
  src="https://cdn.example.com/widget/YOUR_EMBED_KEY.js"
  data-api="https://your-vouchreel-domain.com"></script>
```

Use `data-api` when hosting the script somewhere that is *not* your VouchReel app (e.g. an S3 bucket), so the loader knows where to fetch configuration from.

---

## A page of its own (no website needed)

A widget that sits in a page (a wall, grid, carousel, spotlight and so on, not a corner card) can also be shown on a public page of its own, to share by link or put in a link-in-bio. In the widget's **Install** step turn on **Give it a page of its own** and copy the link (`/wall/<widget id>`).

- It is the real widget, as you last published it. Its page rules and "show on my site" switch do not apply to this page.
- The page is public to anyone with the link, and shows your space's name in its heading. Turn the switch off and the link stops working.
- Visits are counted like any other, under that widget in Analytics.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Nothing appears anywhere | Check the browser console: is the script request blocked (ad-blocker, CSP)? Check the browser network tab for a request to `/api/widget/<key>` — a 404 means the embed key is wrong. |
| Widget never triggers | Check the trigger setting and your page targeting patterns. A delay-based trigger waits N seconds; exit-intent needs mouse movement. |
| Widget shows no testimonials | The space may have no active testimonials, or testimonial match rules/tags filter them out on this page. |
| Widget disappeared after I dismissed it | Expected — dismissal persists for the browser session (`sessionStorage`). Test in a fresh private window. |
| `Content-Security-Policy` errors | Add the widget origin to your `script-src` and the API origin to `connect-src`, e.g. `script-src 'self' https://your-vouchreel-domain.com; connect-src https://your-vouchreel-domain.com`. |
| Widget appears at the old position/colors after a dashboard change | The script is cached (5 min locally, 1 h edge). Wait for the cache or hard-refresh. Config is re-fetched on each page load, so settings changes apply per visit. |
| Two widgets on one page | Make sure the snippet is included once. Multiple spaces on one page are not supported — use one embed key per page. |

Still stuck? The widget never throws errors into your console in production by design, so "nothing in the console" is normal — check the network tab instead.
