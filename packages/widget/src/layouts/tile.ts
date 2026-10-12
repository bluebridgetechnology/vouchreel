import type { LayoutContext } from "../layout-api";
import type { TestimonialItem } from "../matcher";

const el = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};

/**
 * A video as a picture first: the poster (or a muted loop, when the owner allows previews) fills the tile, a play
 * button sits on it, and the person's words and name are on a soft shade along the bottom. Shared by the grid-style
 * layouts and the marquee. Words from visitors go in as text, never markup.
 */
export function videoTile(ctx: LayoutContext, item: TestimonialItem, idx: number): HTMLElement {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "vr-tile vr-blend-video-card";
  tile.setAttribute("aria-label", `Play video testimonial from ${item.customerName || "customer"}`);

  // The picture is the poster, never a loop: a wall of loops would download a video for every tile on the customer's page
  let media: HTMLElement;
  if (item.thumbnailUrl) {
    media = el("img", "vr-tile-img");
    (media as HTMLImageElement).src = item.thumbnailUrl;
    (media as HTMLImageElement).alt = "";
  } else if (item.generated) {
    // A made video has no poster: show its first frames. If the file is gone (taken down), the tile goes with it.
    media = el("video", "vr-tile-img");
    (media as HTMLVideoElement).src = `${item.videoUrl}#t=1`;
    (media as HTMLVideoElement).preload = "metadata";
    (media as HTMLVideoElement).muted = true;
    media.onerror = () => tile.remove();
  } else {
    media = el("span", "vr-tile-img vr-media-initial", (item.customerName || "V").charAt(0).toUpperCase());
  }
  tile.appendChild(media);

  if (item.badge) tile.appendChild(el("span", "vr-tile-badge", String(item.badge)));

  const play = el("span", "vr-tile-play");
  play.setAttribute("aria-hidden", "true");
  play.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  tile.appendChild(play);

  if (item.durationSeconds) {
    const secs = String(item.durationSeconds % 60).padStart(2, "0");
    tile.appendChild(el("span", "vr-tile-time", `${Math.floor(item.durationSeconds / 60)}:${secs}`));
  }

  const info = el("span", "vr-tile-info");
  const quote = ctx.quote(item);
  if (quote.text) {
    const words = el("span", "vr-tile-quote", `"${quote.text}"`);
    if (quote.isTranslated) words.setAttribute("data-translated-lang", quote.lang || "");
    info.appendChild(words);
  }
  const who = el("span", "vr-tile-who");
  who.appendChild(el("span", "vr-tile-avatar", (item.customerName || "C").charAt(0).toUpperCase()));
  const names = el("span", "vr-tile-names");
  names.appendChild(el("span", "vr-tile-name", item.customerName || "Customer"));
  if (item.customerCompany) names.appendChild(el("span", "vr-tile-co", item.customerCompany));
  who.appendChild(names);
  info.appendChild(who);
  tile.appendChild(info);

  tile.addEventListener("click", () => {
    ctx.track("click", item.id);
    ctx.openVideo(idx);
  });
  return tile;
}
