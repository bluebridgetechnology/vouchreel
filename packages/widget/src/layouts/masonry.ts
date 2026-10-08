import { defineLayout } from "../layout-api";
import { interleavedCards } from "./cards";
import cardsCss from "./cards.css";
import css from "./masonry.css";

/** Masonry: staggered columns. */
defineLayout("masonry", {
  css: cardsCss + css,
  inline: true,
  render(ctx) {
    const wrapper = document.createElement("div");
    wrapper.className = "vr-masonry-wrapper";
    for (const card of interleavedCards(ctx)) wrapper.appendChild(card);
    ctx.root.appendChild(wrapper);
  },
});
