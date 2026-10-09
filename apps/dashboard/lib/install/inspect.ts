/**
 * Reading a page's HTML for the Vouchreel script and a widget's spot. Pure: the fetching is in ./check.ts.
 *
 * It sees only what the server sends. A script that a tag manager or the page's own JavaScript adds later is
 * not in that HTML, so "not found" is never proof that a widget is missing; "last seen" (from real visits) is.
 */

export interface InspectInput {
  embedKey: string;
  /** The widget being checked, when there is one. */
  widgetId?: string;
  /** The widget sits in the page (needs a spot) rather than floating in a corner. */
  inline?: boolean;
}

export interface PageInspection {
  /** A script tag for this space's embed key. */
  scriptFound: boolean;
  /** A Vouchreel script tag for a different space (a snippet pasted from somewhere else). */
  otherSpaceScript: boolean;
  /** Inline widgets only: the widget's own spot is in the page (`data-vouchreel-widget="<id>"`). */
  spotFound: boolean | null;
  /** Inline widgets only: the older shared spot (`data-vouchreel-embed`), which means the first widget. */
  legacySpotFound: boolean | null;
  /** The page loads a tag manager, which can add the script after the HTML is sent. */
  tagManager: boolean;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every opening `<script ...>` tag, with its attributes. */
function scriptTags(html: string): string[] {
  return html.match(/<script\b[^>]*>/gi) ?? [];
}

/** The embed key a Vouchreel script tag points at, or null when the tag is not one of ours. */
function keyOfScriptTag(tag: string): string | null {
  const dataKey = /\bdata-key\s*=\s*["']?([A-Za-z0-9_-]+)/i.exec(tag);
  const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1] ?? "";
  const fromPath = /\/widget\/([A-Za-z0-9_-]+)(?:\.js)?(?:[?#].*)?$/.exec(src);
  const isOurs = /\/widget\//.test(src) || /vouchreel/i.test(src);
  if (!isOurs) return null;
  return dataKey?.[1] ?? (fromPath && fromPath[1] !== "vouchreel-widget" ? fromPath[1] : null);
}

export function inspectHtml(html: string, input: InspectInput): PageInspection {
  let scriptFound = false;
  let otherSpaceScript = false;
  for (const tag of scriptTags(html)) {
    const key = keyOfScriptTag(tag);
    if (key === null) continue;
    if (key === input.embedKey) scriptFound = true;
    else otherSpaceScript = true;
  }

  const wantsSpot = Boolean(input.inline);
  const spotFound = wantsSpot && input.widgetId ? new RegExp(`\\bdata-vouchreel-widget\\s*=\\s*["']?${escapeRegex(input.widgetId)}\\b`, "i").test(html) : wantsSpot ? false : null;
  const legacySpotFound = wantsSpot ? /\bdata-vouchreel-embed\b/i.test(html) || /\bid\s*=\s*["']vouchreel-embed["']/i.test(html) : null;

  return {
    scriptFound,
    otherSpaceScript: otherSpaceScript && !scriptFound,
    spotFound,
    legacySpotFound,
    tagManager: /googletagmanager\.com\/(gtm|gtag)|\bgtm\.js\b|cdn\.segment\.com|snippet\.sentry|tagmanager/i.test(html),
  };
}

export interface CheckLine {
  /** true: good, false: a problem, null: a note. */
  ok: boolean | null;
  text: string;
}

/** What to tell the owner about a page, in order. Pure, so the exact wording is tested. */
export function describeInspection(page: PageInspection, input: InspectInput): CheckLine[] {
  const lines: CheckLine[] = [];

  if (page.scriptFound) {
    lines.push({ ok: true, text: "The Vouchreel script is on this page." });
  } else if (page.otherSpaceScript) {
    lines.push({ ok: false, text: "This page has a Vouchreel script, but for a different space. Copy this space's script from the Install step." });
  } else {
    lines.push({ ok: false, text: "The Vouchreel script was not found in this page's HTML." });
    if (page.tagManager) {
      lines.push({ ok: null, text: "The page uses a tag manager. A script added there is not in the HTML we can read, so it may be fine: check \"Last seen\" after visiting the page." });
    } else {
      lines.push({ ok: null, text: "If your site adds scripts with JavaScript, we cannot see it from here: visit the page yourself and check \"Last seen\"." });
    }
  }

  if (input.inline) {
    if (page.spotFound) lines.push({ ok: true, text: "This widget's spot is on the page." });
    else if (page.legacySpotFound) lines.push({ ok: null, text: "The page has the older shared spot (data-vouchreel-embed). It shows your first widget; to show this one, use its own spot from the Install step." });
    else lines.push({ ok: false, text: "This widget sits in your page, but its spot was not found. Copy the spot from the Install step to where it should appear." });
  }

  return lines;
}
