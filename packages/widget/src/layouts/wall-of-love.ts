import { defineLayout } from "../layout-api";
import { interleavedCards } from "./cards";
import cardsCss from "./cards.css";
import css from "./wall-of-love.css";

/** Wall of Love: a responsive grid blending videos and reviews. */
defineLayout("wall-of-love", {
  css: cardsCss + css,
  inline: true,
  render(ctx) {
    const wrapper = document.createElement("div");
    wrapper.className = "vr-wall-wrapper";

    const grid = document.createElement("div");
    grid.className = "vr-wall-grid";
    for (const card of interleavedCards(ctx)) grid.appendChild(card);

    wrapper.appendChild(grid);
    ctx.root.appendChild(wrapper);
  },
});
