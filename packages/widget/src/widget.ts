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
import { fontFamilyFor, readableInheritedColor } from "./typography";
import { applyTheme } from "./style";
import { layoutRegistry, type EffectiveQuote, type LayoutDefinition } from "./layout-api";

export interface WidgetThemeConfig {
  primaryColor?: string;
  accentColor?: string;
  mode?: "light" | "dark" | string;
  borderRadius?: number;
  /** "inherit" uses the host page's font; "custom" uses `fontFamily` (a font the site already loads). */
  fontMode?: "default" | "inherit" | "custom" | string;
  fontFamily?: string;
  /** Use the host page's text colour when it stays readable on the widget background. */
  inheritTextColor?: boolean;
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

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

export interface WidgetWhiteLabelConfig {
  removeBranding?: boolean;
  logoUrl?: string | null;
}

/** A div whose content is text, never markup: names and other words from visitors and review sites must not become HTML on a customer's page. */
function textDiv(className: string, text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

export interface WidgetOptions {
  embedKey: string;
  config: WidgetConfig;
  testimonials: TestimonialItem[];
  reviews?: ReviewItem[];
  analytics?: AnalyticsTracker;
  whiteLabel?: WidgetWhiteLabelConfig;
}

export class VouchreelWidget {
  private embedKey: string;
  private config: WidgetConfig;
  private testimonials: TestimonialItem[];
  private reviews: ReviewItem[];
  private analytics?: AnalyticsTracker;
  private whiteLabel?: WidgetWhiteLabelConfig;

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
  private layout: LayoutDefinition | null = null;

  constructor(options: WidgetOptions) {
    this.embedKey = options.embedKey;
    this.config = options.config || {};
    this.testimonials = options.testimonials || [];
    this.reviews = options.reviews || [];
    this.analytics = options.analytics;
    this.whiteLabel = options.whiteLabel || (options.config as Record<string, unknown>)?.whiteLabel as WidgetWhiteLabelConfig | undefined;
  }

  /**
   * Detects the visitor locale via browser preferences or HTML lang attribute.
   */
  public getVisitorLocale(): string {
    return detectVisitorLocale();
  }

  private getEffectiveQuote(item: TestimonialItem): EffectiveQuote {
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

    // A template whose chunk is not loaded (or is unknown) falls back to the floating card
    this.layout = layoutRegistry()[this.config.template || ""] || null;
    const template = this.layout ? this.config.template : "floating-card";

    // Inject scoped CSS: the core's, plus the layout's own
    const styleEl = document.createElement("style");
    styleEl.textContent = styles + (this.layout?.css || "");
    this.shadowRoot.appendChild(styleEl);

    const isInlineTemplate = Boolean(customEmbedContainer) || Boolean(this.layout?.inline);

    // Root element for CSS custom properties and layout classes
    this.rootWrapper = document.createElement("div");
    this.rootWrapper.className = `vr-theme-root vr-template-${template}`;

    if (!isInlineTemplate) {
      this.rootWrapper.classList.add(
        `vr-pos-${this.config.position || "bottom-right"}`,
        "vr-animate-enter"
      );
    } else {
      // In the page flow, as wide as its container (the host is otherwise fixed to a corner)
      this.hostElement.classList.add("vr-inline");
      this.rootWrapper.style.width = "100%";
      this.rootWrapper.style.position = "relative";
    }

    applyTheme(this.rootWrapper, this.config.theme);

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
    this.applyTypography();

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

  /**
   * Font and text colour from the host page. Runs after the host is in the document, because both
   * come from the page's computed styles. The shadow root resets inheritance (`all: initial`), so
   * this is opt-in per widget and never loads fonts itself.
   */
  private applyTypography(): void {
    const theme = this.config.theme;
    if (!theme || !this.hostElement || !this.rootWrapper) return;

    const font = fontFamilyFor(theme.fontMode, theme.fontFamily);
    if (font) this.hostElement.style.fontFamily = font;

    if (theme.inheritTextColor === true) {
      const pageElement = this.hostElement.parentElement;
      const color = readableInheritedColor(
        pageElement ? getComputedStyle(pageElement).color : "",
        getComputedStyle(this.rootWrapper).getPropertyValue("--vr-bg")
      );
      if (color) {
        this.rootWrapper.style.setProperty("--vr-text", color);
        this.rootWrapper.style.setProperty("--vr-text-muted", `color-mix(in srgb, ${color} 65%, var(--vr-bg))`);
      }
    }
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
   * Draws the collapsed state: the layout chunk when there is one, otherwise the floating card.
   */
  private renderTemplate(): void {
    if (!this.rootWrapper) return;
    this.rootWrapper.innerHTML = "";
    this.isExpanded = false;
    if (this.activePlayer) {
      this.activePlayer.destroy();
      this.activePlayer = null;
    }

    if (this.layout) {
      this.layout.render({
        root: this.rootWrapper,
        testimonials: this.testimonials,
        reviews: this.reviews,
        quote: (item) => this.getEffectiveQuote(item),
        openVideo: (index) => this.expandVideo(index),
        openReview: (review) => this.expandReview(review),
        track: (type, id) => this.analytics?.track(type, id),
        theme: this.config.theme,
      });
      this.maybeRestoreFocus();
    } else {
      this.renderCollapsed();
    }
  }

  /**
   * The default layout, kept in the core so the most common setup needs no extra download:
   * a minimal floating card in a corner.
   */
  private renderCollapsed(): void {
    if (!this.rootWrapper) return;

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
      info.appendChild(textDiv("vr-card-name", firstReview.authorName));
      info.appendChild(textDiv("vr-card-quote", `★ ${firstReview.rating}.0 on ${firstReview.provider}`));
      openBtn.appendChild(info);
      openBtn.addEventListener("click", () => this.expandReview(firstReview));
      card.appendChild(openBtn);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "vr-close-btn";
      closeBtn.setAttribute("aria-label", "Dismiss widget");
      closeBtn.innerHTML = CLOSE_ICON;
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
    playBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
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
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dismiss();
    });
    card.appendChild(closeBtn);

    this.rootWrapper.appendChild(card);
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
    closeBtn.innerHTML = CLOSE_ICON;
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
      prevBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
      prevBtn.addEventListener("click", () => this.prev());

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "vr-nav-btn";
      nextBtn.setAttribute("aria-label", "Next testimonial");
      nextBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      nextBtn.addEventListener("click", () => this.next());

      controls.appendChild(prevBtn);
      controls.appendChild(nextBtn);
      meta.appendChild(controls);
    }

    body.appendChild(meta);
    modal.appendChild(body);

    if (!this.whiteLabel?.removeBranding) {
      const poweredBy = document.createElement("div");
      poweredBy.className = "vr-powered-by";
      if (this.whiteLabel?.logoUrl) {
        const logoImg = document.createElement("img");
        logoImg.src = this.whiteLabel.logoUrl;
        logoImg.alt = "Brand Logo";
        logoImg.className = "vr-powered-by-logo";
        logoImg.style.maxHeight = "14px";
        logoImg.style.marginRight = "6px";
        logoImg.style.verticalAlign = "middle";
        poweredBy.appendChild(logoImg);
      }
      const textNode = document.createTextNode(
        this.whiteLabel?.logoUrl ? "Powered by our community" : "Verified by Vouchreel"
      );
      poweredBy.appendChild(textNode);
      modal.appendChild(poweredBy);
    }

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
    closeBtn.innerHTML = CLOSE_ICON;
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
    nameWrap.appendChild(textDiv("vr-review-modal-author", review.authorName));
    if (dateStr) nameWrap.appendChild(textDiv("vr-review-modal-date", dateStr));
    authorGroup.appendChild(nameWrap);
    header.appendChild(authorGroup);

    const badge = document.createElement("span");
    badge.className = `vr-provider-badge ${
      review.provider === "google" ? "vr-badge-google" : "vr-badge-trustpilot"
    }`;
    badge.textContent =
      review.provider === "google" ? "Google Maps" : "Trustpilot Verified";
    header.appendChild(badge);

    body.appendChild(header);

    const stars = document.createElement("div");
    stars.className = "vr-stars";
    stars.style.fontSize = "18px";
    stars.textContent = Array.from({ length: 5 })
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
    if (!this.rootWrapper) return this.destroy();
    this.rootWrapper.classList.remove("vr-animate-enter");
    this.rootWrapper.classList.add("vr-animate-leave");
    // Removed once the leave animation has played
    setTimeout(() => this.destroy(), 250);
  }

  /** Removes the widget and everything it listens to (the editor preview re-mounts on every change). */
  public destroy(): void {
    this.activePlayer?.destroy();
    this.activePlayer = null;
    if (this.keydownListener) document.removeEventListener("keydown", this.keydownListener);
    this.keydownListener = null;
    this.hostElement?.remove();
    this.isMounted = false;
  }
}
