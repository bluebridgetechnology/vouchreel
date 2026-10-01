import styles from "./styles.css";
import {
  TestimonialItem,
  ReviewItem,
  detectVisitorLocale,
  resolveTestimonialTranslation,
  TranscriptCue,
} from "./matcher";
import { createVideoPlayer, VideoPlayerController } from "./player";
import { AnalyticsTracker } from "./analytics";
import { markDismissed } from "./triggers";

export interface WidgetThemeConfig {
  primaryColor?: string;
  accentColor?: string;
  mode?: "light" | "dark" | string;
  borderRadius?: number;
  [key: string]: unknown;
}

export interface WidgetConfig {
  template?:
    | "wall-of-love"
    | "carousel"
    | "story-strip"
    | "floating-card"
    | "masonry"
    | string;
  position?: "bottom-right" | "bottom-left" | "bottom-bar" | "story-strip" | string;
  theme?: WidgetThemeConfig;
  autoplayPreview?: boolean;
  [key: string]: unknown;
}

export interface WidgetOptions {
  embedKey: string;
  config: WidgetConfig;
  testimonials: TestimonialItem[];
  reviews?: ReviewItem[];
  analytics?: AnalyticsTracker;
}

export class VouchreelWidget {
  private embedKey: string;
  private config: WidgetConfig;
  private testimonials: TestimonialItem[];
  private reviews: ReviewItem[];
  private analytics?: AnalyticsTracker;

  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private rootWrapper: HTMLElement | null = null;
  private activePlayer: VideoPlayerController | null = null;

  private currentIndex = 0;
  private isExpanded = false;
  private isMounted = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private liveRegion: HTMLElement | null = null;
  private previouslyFocusedEl: HTMLElement | null = null;
  private restoreFocusOnRender = false;

  constructor(options: WidgetOptions) {
    this.embedKey = options.embedKey;
    this.config = options.config || {};
    this.testimonials = options.testimonials || [];
    this.reviews = options.reviews || [];
    this.analytics = options.analytics;
  }

  /**
   * Detects the visitor locale via browser preferences or HTML lang attribute.
   */
  public getVisitorLocale(): string {
    return detectVisitorLocale();
  }

  private getEffectiveQuote(item: TestimonialItem): {
    text: string | null;
    isTranslated: boolean;
    lang?: string;
  } {
    const visitorLang = this.getVisitorLocale();
    const translation = resolveTestimonialTranslation(item, visitorLang);
    if (translation?.quote) {
      return {
        text: translation.quote,
        isTranslated: true,
        lang: translation.language,
      };
    }
    return {
      text: item.quote || item.title || null,
      isTranslated: false,
    };
  }

  private getEffectiveCues(item: TestimonialItem): Array<TranscriptCue> | null {
    const visitorLang = this.getVisitorLocale();
    const translation = resolveTestimonialTranslation(item, visitorLang);
    if (
      translation?.transcript &&
      Array.isArray(translation.transcript) &&
      translation.transcript.length > 0
    ) {
      return translation.transcript;
    }
    return null;
  }

  /**
   * Mounts the widget into the DOM inside an isolated open Shadow DOM.
   */
  public mount(): void {
    if (this.isMounted || typeof document === "undefined") return;
    if (this.testimonials.length === 0 && this.reviews.length === 0) return;

    // Check if an inline embed target container is present on the host page
    const customEmbedContainer =
      document.querySelector<HTMLElement>("[data-vouchreel-embed]") ||
      document.getElementById("vouchreel-embed");

    // Create host container
    this.hostElement = document.createElement("div");
    this.hostElement.id = `vouchreel-widget-${this.embedKey}`;
    this.hostElement.className = "vouchreel-host-container";
    this.hostElement.setAttribute("role", "region");
    this.hostElement.setAttribute("aria-label", "Customer testimonials and reviews");

    // Attach Shadow DOM
    this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });

    // Inject scoped CSS
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    this.shadowRoot.appendChild(styleEl);

    const template = this.config.template || "floating-card";
    const isInlineTemplate =
      Boolean(customEmbedContainer) ||
      template === "wall-of-love" ||
      template === "masonry" ||
      template === "carousel";

    // Root element for CSS custom properties and layout classes
    this.rootWrapper = document.createElement("div");
    this.rootWrapper.className = `vr-theme-root vr-template-${template}`;

    if (!isInlineTemplate) {
      this.rootWrapper.classList.add(
        `vr-pos-${this.config.position || "bottom-right"}`,
        "vr-animate-enter"
      );
    } else {
      this.rootWrapper.style.width = "100%";
      this.rootWrapper.style.position = "relative";
    }

    if (this.config.theme?.mode === "dark") {
      this.rootWrapper.classList.add("vr-dark");
    }

    // Apply custom theme properties
    if (this.config.theme?.primaryColor) {
      this.rootWrapper.style.setProperty("--vr-primary", this.config.theme.primaryColor);
    }
    if (this.config.theme?.accentColor) {
      this.rootWrapper.style.setProperty("--vr-accent", this.config.theme.accentColor);
    }
    if (typeof this.config.theme?.borderRadius === "number") {
      this.rootWrapper.style.setProperty(
        "--vr-radius",
        `${this.config.theme.borderRadius}px`
      );
    }

    this.shadowRoot.appendChild(this.rootWrapper);

    this.rootWrapper.addEventListener("animationend", (e) => {
      if (e.target === this.rootWrapper && this.rootWrapper) {
        this.rootWrapper.classList.remove("vr-animate-enter");
      }
    });

    // Visually hidden live region for screen reader updates
    this.liveRegion = document.createElement("div");
    this.liveRegion.className = "vr-sr-only";
    this.liveRegion.setAttribute("role", "status");
    this.shadowRoot.appendChild(this.liveRegion);

    if (customEmbedContainer) {
      customEmbedContainer.appendChild(this.hostElement);
    } else {
      document.body.appendChild(this.hostElement);
    }
    this.isMounted = true;

    // Track impression
    if (this.analytics) {
      const currentTestimonial = this.testimonials[0];
      this.analytics.track("impression", currentTestimonial?.id);
    }

    // Render chosen template
    this.renderTemplate();
    this.announce("Testimonials and reviews widget is now available.");

    // Listen for Escape key + tab trapping
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (this.isExpanded) {
          this.collapse();
        } else if (!isInlineTemplate) {
          this.dismiss();
        }
      } else if (e.key === "Tab" && this.isExpanded) {
        this.trapFocus(e);
      }
    };
    document.addEventListener("keydown", this.keydownListener);
  }

  private announce(message: string): void {
    if (!this.liveRegion) return;
    this.liveRegion.textContent = "";
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
      }
    }, 100);
  }

  private trapFocus(e: KeyboardEvent): void {
    if (!this.shadowRoot) return;
    const focusables = Array.from(
      this.shadowRoot.querySelectorAll<HTMLElement>(
        'button, a[href], iframe, video[controls], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = this.shadowRoot.activeElement as HTMLElement | null;

    if (!active) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * Dispatches to the appropriate template renderer.
   */
  private renderTemplate(): void {
    const template = this.config.template || "floating-card";
    switch (template) {
      case "wall-of-love":
        this.renderWallOfLove();
        break;
      case "carousel":
        this.renderCarousel();
        break;
      case "masonry":
        this.renderMasonry();
        break;
      case "story-strip":
        this.renderStoryStrip();
        break;
      case "floating-card":
      default:
        this.renderCollapsed();
        break;
    }
  }

  /**
   * Helper to create a video card element used in Wall of Love, Carousel, and Masonry.
   */
  private createVideoCard(item: TestimonialItem, idx: number): HTMLElement {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "vr-card vr-blend-video-card";
    card.setAttribute(
      "aria-label",
      `Play video testimonial from ${item.customerName || "customer"}`
    );

    // Media Thumbnail
    const thumb = document.createElement("div");
    thumb.className = "vr-card-video-thumb";

    if (item.thumbnailUrl) {
      const img = document.createElement("img");
      img.src = item.thumbnailUrl;
      img.alt = item.customerName || "Video testimonial thumbnail";
      thumb.appendChild(img);
    }

    const playBadge = document.createElement("div");
    playBadge.className = "vr-play-badge";
    playBadge.setAttribute("aria-hidden", "true");
    playBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    thumb.appendChild(playBadge);

    if (item.durationSeconds) {
      const duration = document.createElement("span");
      duration.className = "vr-card-duration";
      const mins = Math.floor(item.durationSeconds / 60);
      const secs = String(item.durationSeconds % 60).padStart(2, "0");
      duration.textContent = `${mins}:${secs}`;
      thumb.appendChild(duration);
    }

    card.appendChild(thumb);

    // Badge
    const badgeRow = document.createElement("div");
    badgeRow.innerHTML = `<span class="vr-provider-badge vr-badge-video">📹 Video Testimonial</span>`;
    card.appendChild(badgeRow);

    // Quote / Title (with multi-language translation support)
    const effective = this.getEffectiveQuote(item);
    if (effective.text) {
      const text = document.createElement("p");
      text.className = "vr-card-quote-text";
      text.textContent = `"${effective.text}"`;
      if (effective.isTranslated) {
        text.setAttribute("data-translated-lang", effective.lang || "");
      }
      card.appendChild(text);
    }

    // Author
    const authorRow = document.createElement("div");
    authorRow.className = "vr-card-author-row";

    const initial = (item.customerName || "C").charAt(0).toUpperCase();
    const avatar = document.createElement("div");
    avatar.className = "vr-card-avatar";
    avatar.textContent = initial;
    authorRow.appendChild(avatar);

    const info = document.createElement("div");
    info.innerHTML = `
      <div class="vr-card-author-name">${item.customerName || "Customer"}</div>
      ${item.customerCompany ? `<div class="vr-card-author-sub">${item.customerCompany}</div>` : ""}
    `;
    authorRow.appendChild(info);
    card.appendChild(authorRow);

    card.addEventListener("click", () => {
      if (this.analytics) {
        this.analytics.track("click", item.id);
      }
      this.expandVideo(idx);
    });

    return card;
  }

  /**
   * Helper to create a text review card used in Wall of Love, Carousel, and Masonry.
   */
  private createReviewCard(review: ReviewItem): HTMLElement {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "vr-card vr-blend-review-card";
    card.setAttribute(
      "aria-label",
      `View review from ${review.authorName} on ${review.provider}`
    );

    // Top Row: Source Badge & Stars
    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.alignItems = "center";
    topRow.style.justifyContent = "space-between";
    topRow.style.gap = "8px";

    const badge = document.createElement("span");
    badge.className = `vr-provider-badge ${
      review.provider === "google" ? "vr-badge-google" : "vr-badge-trustpilot"
    }`;
    badge.textContent = review.provider === "google" ? "Google" : "Trustpilot";
    topRow.appendChild(badge);

    const stars = document.createElement("div");
    stars.className = "vr-stars";
    stars.innerHTML = Array.from({ length: 5 })
      .map((_, i) => (i < review.rating ? "★" : "☆"))
      .join("");
    topRow.appendChild(stars);
    card.appendChild(topRow);

    // Review Text
    if (review.text) {
      const text = document.createElement("p");
      text.className = "vr-card-quote-text";
      text.textContent = `"${review.text}"`;
      card.appendChild(text);
    }

    // Author Row
    const authorRow = document.createElement("div");
    authorRow.className = "vr-card-author-row";

    if (review.authorPhotoUrl) {
      const img = document.createElement("img");
      img.src = review.authorPhotoUrl;
      img.alt = review.authorName;
      img.className = "vr-card-avatar";
      authorRow.appendChild(img);
    } else {
      const initial = (review.authorName || "A").charAt(0).toUpperCase();
      const avatar = document.createElement("div");
      avatar.className = "vr-card-avatar";
      avatar.textContent = initial;
      authorRow.appendChild(avatar);
    }

    const info = document.createElement("div");
    const dateStr = review.reviewDate
      ? new Date(review.reviewDate).toLocaleDateString()
      : "";
    info.innerHTML = `
      <div class="vr-card-author-name">${review.authorName}</div>
      ${dateStr ? `<div class="vr-card-author-sub">${dateStr}</div>` : ""}
    `;
    authorRow.appendChild(info);
    card.appendChild(authorRow);

    card.addEventListener("click", () => {
      this.expandReview(review);
    });

    return card;
  }

  /**
   * Template 1: Wall of Love — responsive grid blending videos and reviews.
   */
  private renderWallOfLove(): void {
    if (!this.rootWrapper) return;
    this.rootWrapper.innerHTML = "";
    this.isExpanded = false;

    const wrapper = document.createElement("div");
    wrapper.className = "vr-wall-wrapper";

    const grid = document.createElement("div");
    grid.className = "vr-wall-grid";

    // Interleave video testimonials and text reviews
    const maxLen = Math.max(this.testimonials.length, this.reviews.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < this.testimonials.length) {
        grid.appendChild(this.createVideoCard(this.testimonials[i], i));
      }
      if (i < this.reviews.length) {
        grid.appendChild(this.createReviewCard(this.reviews[i]));
      }
    }

    wrapper.appendChild(grid);
    this.rootWrapper.appendChild(wrapper);
    this.maybeRestoreFocus();
  }

  /**
   * Template 2: Carousel / Slider — horizontal scroll slider with controls.
   */
  private renderCarousel(): void {
    if (!this.rootWrapper) return;
    this.rootWrapper.innerHTML = "";
    this.isExpanded = false;

    const container = document.createElement("div");
    container.className = "vr-carousel-container";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "vr-carousel-arrow vr-carousel-prev";
    prevBtn.setAttribute("aria-label", "Previous items");
    prevBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "vr-carousel-arrow vr-carousel-next";
    nextBtn.setAttribute("aria-label", "Next items");
    nextBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;

    const track = document.createElement("div");
    track.className = "vr-carousel-track";

    // Interleave videos and reviews
    const maxLen = Math.max(this.testimonials.length, this.reviews.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < this.testimonials.length) {
        track.appendChild(this.createVideoCard(this.testimonials[i], i));
      }
      if (i < this.reviews.length) {
        track.appendChild(this.createReviewCard(this.reviews[i]));
      }
    }

    prevBtn.addEventListener("click", () => {
      track.scrollBy({ left: -310, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
      track.scrollBy({ left: 310, behavior: "smooth" });
    });

    container.appendChild(prevBtn);
    container.appendChild(track);
    container.appendChild(nextBtn);

    this.rootWrapper.appendChild(container);
    this.maybeRestoreFocus();
  }

  /**
   * Template 3: Story Strip — Instagram-style circles with video/review rings.
   */
  private renderStoryStrip(): void {
    if (!this.rootWrapper) return;
    this.rootWrapper.innerHTML = "";
    this.isExpanded = false;

    const stripWrapper = document.createElement("div");
    stripWrapper.className = "vr-strip-wrapper";

    // Video story circles
    this.testimonials.slice(0, 4).forEach((item, idx) => {
      const storyItem = document.createElement("button");
      storyItem.type = "button";
      storyItem.className = "vr-story-item";
      storyItem.setAttribute(
        "aria-label",
        `Play video testimonial from ${item.customerName || "Customer"}`
      );
      storyItem.setAttribute("title", item.customerName || "Video testimonial");

      if (item.thumbnailUrl) {
        const img = document.createElement("img");
        img.src = item.thumbnailUrl;
        img.alt = item.customerName || "Testimonial";
        storyItem.appendChild(img);
      } else {
        const initial = (item.customerName || "V").charAt(0).toUpperCase();
        storyItem.textContent = initial;
      }

      storyItem.addEventListener("click", () => {
        if (this.analytics) {
          this.analytics.track("click", item.id);
        }
        this.expandVideo(idx);
      });

      stripWrapper.appendChild(storyItem);
    });

    // Review story circles
    this.reviews.slice(0, 3).forEach((review) => {
      const storyItem = document.createElement("button");
      storyItem.type = "button";
      storyItem.className = `vr-story-item ${
        review.provider === "google"
          ? "vr-story-review-google"
          : "vr-story-review-trustpilot"
      }`;
      storyItem.setAttribute(
        "aria-label",
        `View review from ${review.authorName} on ${review.provider}`
      );
      storyItem.setAttribute("title", `${review.authorName} (${review.provider})`);

      if (review.authorPhotoUrl) {
        const img = document.createElement("img");
        img.src = review.authorPhotoUrl;
        img.alt = review.authorName;
        storyItem.appendChild(img);
      } else {
        const initial = (review.authorName || "R").charAt(0).toUpperCase();
        storyItem.textContent = initial;
      }

      // Small star badge
      const starBadge = document.createElement("span");
      starBadge.className = "vr-story-badge";
      starBadge.textContent = "★";
      storyItem.appendChild(starBadge);

      storyItem.addEventListener("click", () => {
        this.expandReview(review);
      });

      stripWrapper.appendChild(storyItem);
    });

    this.rootWrapper.appendChild(stripWrapper);
    this.maybeRestoreFocus();
  }

  /**
   * Template 4: Minimal Floating Card — corner card launcher.
   */
  private renderCollapsed(): void {
    if (!this.rootWrapper) return;
    this.rootWrapper.innerHTML = "";
    this.isExpanded = false;

    if (this.activePlayer) {
      this.activePlayer.destroy();
      this.activePlayer = null;
    }

    const current = this.testimonials[this.currentIndex] || this.testimonials[0];

    // If no video testimonials exist, show the first text review
    if (!current && this.reviews.length > 0) {
      const firstReview = this.reviews[0];
      const card = document.createElement("div");
      card.className = "vr-collapsed-card";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "vr-open-btn";
      openBtn.setAttribute(
        "aria-label",
        `View review from ${firstReview.authorName} on ${firstReview.provider}`
      );

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "vr-thumb-wrapper";
      if (firstReview.authorPhotoUrl) {
        const img = document.createElement("img");
        img.src = firstReview.authorPhotoUrl;
        img.alt = firstReview.authorName;
        thumbWrap.appendChild(img);
      } else {
        thumbWrap.style.display = "flex";
        thumbWrap.style.alignItems = "center";
        thumbWrap.style.justifyContent = "center";
        thumbWrap.style.backgroundColor = "var(--vr-primary)";
        thumbWrap.style.color = "var(--vr-accent)";
        thumbWrap.style.fontWeight = "bold";
        thumbWrap.textContent = (firstReview.authorName || "R").charAt(0).toUpperCase();
      }
      openBtn.appendChild(thumbWrap);

      const info = document.createElement("div");
      info.className = "vr-card-info";
      info.innerHTML = `
        <div class="vr-card-name">${firstReview.authorName}</div>
        <div class="vr-card-quote">★ ${firstReview.rating}.0 on ${firstReview.provider}</div>
      `;
      openBtn.appendChild(info);
      openBtn.addEventListener("click", () => this.expandReview(firstReview));
      card.appendChild(openBtn);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "vr-close-btn";
      closeBtn.setAttribute("aria-label", "Dismiss widget");
      closeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.dismiss();
      });
      card.appendChild(closeBtn);
      this.rootWrapper.appendChild(card);
      this.maybeRestoreFocus();
      return;
    }

    if (!current) return;

    const card = document.createElement("div");
    card.className = "vr-collapsed-card";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "vr-open-btn";
    openBtn.setAttribute(
      "aria-label",
      `Play video testimonial${current.customerName ? ` from ${current.customerName}` : ""}`
    );

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "vr-thumb-wrapper";

    if (current.thumbnailUrl) {
      const img = document.createElement("img");
      img.src = current.thumbnailUrl;
      img.alt = current.customerName || "Testimonial";
      thumbWrap.appendChild(img);
    }

    const playBadge = document.createElement("div");
    playBadge.className = "vr-play-badge";
    playBadge.setAttribute("aria-hidden", "true");
    playBadge.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `;
    thumbWrap.appendChild(playBadge);
    openBtn.appendChild(thumbWrap);

    const info = document.createElement("div");
    info.className = "vr-card-info";

    const name = document.createElement("div");
    name.className = "vr-card-name";
    name.textContent = current.customerName || current.title || "Video Testimonial";
    info.appendChild(name);

    const effectiveQuote = this.getEffectiveQuote(current);
    if (effectiveQuote.text) {
      const quote = document.createElement("div");
      quote.className = "vr-card-quote";
      quote.textContent = `"${effectiveQuote.text}"`;
      if (effectiveQuote.isTranslated) {
        quote.setAttribute("data-translated-lang", effectiveQuote.lang || "");
      }
      info.appendChild(quote);
    }
    openBtn.appendChild(info);

    openBtn.addEventListener("click", () => {
      if (this.analytics) {
        this.analytics.track("click", current.id);
      }
      this.expandVideo(this.currentIndex);
    });
    card.appendChild(openBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "vr-close-btn";
    closeBtn.setAttribute("aria-label", "Dismiss testimonial widget");
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dismiss();
    });
    card.appendChild(closeBtn);

    this.rootWrapper.appendChild(card);
    this.maybeRestoreFocus();
  }

  /**
   * Template 5: Masonry Grid — Pinterest-style staggered columns.
   */
  private renderMasonry(): void {
    if (!this.rootWrapper) return;
    this.rootWrapper.innerHTML = "";
    this.isExpanded = false;

    const wrapper = document.createElement("div");
    wrapper.className = "vr-masonry-wrapper";

    const maxLen = Math.max(this.testimonials.length, this.reviews.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < this.testimonials.length) {
        wrapper.appendChild(this.createVideoCard(this.testimonials[i], i));
      }
      if (i < this.reviews.length) {
        wrapper.appendChild(this.createReviewCard(this.reviews[i]));
      }
    }

    this.rootWrapper.appendChild(wrapper);
    this.maybeRestoreFocus();
  }

  /**
   * Expands into the video player modal dialog.
   */
  public expandVideo(index: number = 0): void {
    if (!this.rootWrapper) return;
    if (!this.isExpanded && this.shadowRoot) {
      this.previouslyFocusedEl = this.shadowRoot.activeElement as HTMLElement | null;
    }
    this.isExpanded = true;
    this.currentIndex = index;

    const current = this.testimonials[this.currentIndex];
    if (!current) return;

    this.rootWrapper.innerHTML = "";

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "vr-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", () => this.collapse());
    this.rootWrapper.appendChild(backdrop);

    // Modal dialog
    const modal = document.createElement("div");
    modal.className = `vr-expanded-modal vr-pos-${this.config.position || "bottom-right"}`;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute(
      "aria-label",
      current.customerName
        ? `Video testimonial from ${current.customerName}`
        : "Video testimonial player"
    );
    modal.tabIndex = -1;

    const grabber = document.createElement("div");
    grabber.className = "vr-sheet-grabber";
    grabber.setAttribute("aria-hidden", "true");
    modal.appendChild(grabber);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "vr-modal-close-btn";
    closeBtn.setAttribute("aria-label", "Close player");
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener("click", () => this.collapse());
    modal.appendChild(closeBtn);

    const playerContainer = document.createElement("div");
    playerContainer.className = "vr-player-container";
    modal.appendChild(playerContainer);

    const cues = this.getEffectiveCues(current);
    const visitorLang = this.getVisitorLocale();

    this.activePlayer = createVideoPlayer({
      container: playerContainer,
      videoUrl: current.videoUrl,
      platform: current.platform,
      thumbnailUrl: current.thumbnailUrl,
      autoplayPreview: this.config.autoplayPreview,
      subtitles: cues,
      subtitleLanguage: visitorLang,
      onPlay: () => {
        if (this.analytics) {
          this.analytics.track("play", current.id);
        }
      },
      onEnded: () => {
        this.next();
      },
    });

    const body = document.createElement("div");
    body.className = "vr-modal-body";

    const effectiveModalQuote = this.getEffectiveQuote(current);
    if (effectiveModalQuote.text) {
      const quote = document.createElement("p");
      quote.className = "vr-modal-quote";
      if (effectiveModalQuote.isTranslated) {
        const langBadge = document.createElement("span");
        langBadge.className = "vr-lang-badge";
        langBadge.textContent = (effectiveModalQuote.lang || visitorLang).toUpperCase();
        quote.appendChild(langBadge);
      }
      const textNode = document.createTextNode(`"${effectiveModalQuote.text}"`);
      quote.appendChild(textNode);
      body.appendChild(quote);
    }

    const meta = document.createElement("div");
    meta.className = "vr-modal-meta";

    const authorWrap = document.createElement("div");
    const author = document.createElement("div");
    author.className = "vr-modal-author";
    author.textContent = current.customerName || current.title || "";
    authorWrap.appendChild(author);

    if (current.customerCompany) {
      const company = document.createElement("div");
      company.className = "vr-modal-company";
      company.textContent = current.customerCompany;
      authorWrap.appendChild(company);
    }
    meta.appendChild(authorWrap);

    if (this.testimonials.length > 1) {
      const controls = document.createElement("div");
      controls.className = "vr-carousel-controls";

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "vr-nav-btn";
      prevBtn.setAttribute("aria-label", "Previous testimonial");
      prevBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      `;
      prevBtn.addEventListener("click", () => this.prev());

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "vr-nav-btn";
      nextBtn.setAttribute("aria-label", "Next testimonial");
      nextBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
      nextBtn.addEventListener("click", () => this.next());

      controls.appendChild(prevBtn);
      controls.appendChild(nextBtn);
      meta.appendChild(controls);
    }

    body.appendChild(meta);
    modal.appendChild(body);

    const poweredBy = document.createElement("div");
    poweredBy.className = "vr-powered-by";
    poweredBy.textContent = "Verified by Vouchreel";
    modal.appendChild(poweredBy);

    this.rootWrapper.appendChild(modal);
    modal.focus();
  }

  /**
   * Expands into the full text review detail modal.
   */
  public expandReview(review: ReviewItem): void {
    if (!this.rootWrapper) return;
    if (!this.isExpanded && this.shadowRoot) {
      this.previouslyFocusedEl = this.shadowRoot.activeElement as HTMLElement | null;
    }
    this.isExpanded = true;

    this.rootWrapper.innerHTML = "";

    const backdrop = document.createElement("div");
    backdrop.className = "vr-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", () => this.collapse());
    this.rootWrapper.appendChild(backdrop);

    const modal = document.createElement("div");
    modal.className = `vr-expanded-modal vr-pos-${this.config.position || "bottom-right"}`;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", `Review from ${review.authorName}`);
    modal.tabIndex = -1;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "vr-modal-close-btn";
    closeBtn.setAttribute("aria-label", "Close review");
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener("click", () => this.collapse());
    modal.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "vr-review-modal-body";

    const header = document.createElement("div");
    header.className = "vr-review-modal-header";

    const authorGroup = document.createElement("div");
    authorGroup.style.display = "flex";
    authorGroup.style.alignItems = "center";
    authorGroup.style.gap = "10px";

    if (review.authorPhotoUrl) {
      const img = document.createElement("img");
      img.src = review.authorPhotoUrl;
      img.alt = review.authorName;
      img.className = "vr-card-avatar";
      authorGroup.appendChild(img);
    } else {
      const initial = (review.authorName || "A").charAt(0).toUpperCase();
      const avatar = document.createElement("div");
      avatar.className = "vr-card-avatar";
      avatar.textContent = initial;
      authorGroup.appendChild(avatar);
    }

    const nameWrap = document.createElement("div");
    const dateStr = review.reviewDate
      ? new Date(review.reviewDate).toLocaleDateString()
      : "";
    nameWrap.innerHTML = `
      <div style="font-weight: 600; font-size: 13px;">${review.authorName}</div>
      ${dateStr ? `<div style="font-size: 11px; color: var(--vr-text-muted);">${dateStr}</div>` : ""}
    `;
    authorGroup.appendChild(nameWrap);
    header.appendChild(authorGroup);

    const badge = document.createElement("span");
    badge.className = `vr-provider-badge ${
      review.provider === "google" ? "vr-badge-google" : "vr-badge-trustpilot"
    }`;
    badge.textContent =
      review.provider === "google" ? "Google Reviews" : "Trustpilot Verified";
    header.appendChild(badge);

    body.appendChild(header);

    const stars = document.createElement("div");
    stars.className = "vr-stars";
    stars.style.fontSize = "18px";
    stars.innerHTML = Array.from({ length: 5 })
      .map((_, i) => (i < review.rating ? "★" : "☆"))
      .join("");
    body.appendChild(stars);

    if (review.text) {
      const text = document.createElement("div");
      text.className = "vr-review-modal-text";
      text.textContent = review.text;
      body.appendChild(text);
    }

    modal.appendChild(body);

    const poweredBy = document.createElement("div");
    poweredBy.className = "vr-powered-by";
    poweredBy.textContent = "Verified customer review";
    modal.appendChild(poweredBy);

    this.rootWrapper.appendChild(modal);
    modal.focus();
  }

  // Alias for backward-compatibility with tests and call sites
  public expand(index: number = 0): void {
    this.expandVideo(index);
  }

  public next(): void {
    if (this.testimonials.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.testimonials.length;
    this.expandVideo(this.currentIndex);
  }

  public prev(): void {
    if (this.testimonials.length <= 1) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.testimonials.length) % this.testimonials.length;
    this.expandVideo(this.currentIndex);
  }

  public collapse(): void {
    if (!this.isExpanded) return;
    this.restoreFocusOnRender = true;
    this.renderTemplate();
  }

  private maybeRestoreFocus(): void {
    if (!this.restoreFocusOnRender || !this.rootWrapper) return;
    this.restoreFocusOnRender = false;
    const target = this.rootWrapper.querySelector<HTMLElement>(
      ".vr-open-btn, .vr-story-item, .vr-card"
    );
    if (target) {
      target.focus();
    } else if (this.previouslyFocusedEl) {
      this.previouslyFocusedEl.focus();
    }
    this.previouslyFocusedEl = null;
  }

  public dismiss(): void {
    markDismissed(this.embedKey);

    if (this.activePlayer) {
      this.activePlayer.destroy();
      this.activePlayer = null;
    }

    if (this.keydownListener) {
      document.removeEventListener("keydown", this.keydownListener);
      this.keydownListener = null;
    }

    if (this.rootWrapper) {
      this.rootWrapper.classList.remove("vr-animate-enter");
      this.rootWrapper.classList.add("vr-animate-leave");

      setTimeout(() => {
        if (this.hostElement && this.hostElement.parentNode) {
          this.hostElement.parentNode.removeChild(this.hostElement);
        }
        this.isMounted = false;
      }, 250);
    }
  }
}
