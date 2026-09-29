import styles from "./styles.css";
import { TestimonialItem } from "./matcher";
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
  position?: "bottom-right" | "bottom-left" | "bottom-bar" | "story-strip" | string;
  theme?: WidgetThemeConfig;
  autoplayPreview?: boolean;
  [key: string]: unknown;
}

export interface WidgetOptions {
  embedKey: string;
  config: WidgetConfig;
  testimonials: TestimonialItem[];
  analytics?: AnalyticsTracker;
}

export class VouchreelWidget {
  private embedKey: string;
  private config: WidgetConfig;
  private testimonials: TestimonialItem[];
  private analytics?: AnalyticsTracker;

  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private rootWrapper: HTMLElement | null = null;
  private activePlayer: VideoPlayerController | null = null;

  private currentIndex = 0;
  private isExpanded = false;
  private isMounted = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: WidgetOptions) {
    this.embedKey = options.embedKey;
    this.config = options.config || {};
    this.testimonials = options.testimonials || [];
    this.analytics = options.analytics;
  }

  /**
   * Mounts the widget into the DOM inside an isolated open Shadow DOM.
   */
  public mount(): void {
    if (this.isMounted || typeof document === "undefined") return;
    if (!this.testimonials || this.testimonials.length === 0) return;

    // Create host container
    this.hostElement = document.createElement("div");
    this.hostElement.id = `vouchreel-widget-${this.embedKey}`;
    this.hostElement.className = "vouchreel-host-container";

    // Attach Shadow DOM
    this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });

    // Inject scoped CSS
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    this.shadowRoot.appendChild(styleEl);

    // Root element for CSS custom properties and position classes
    this.rootWrapper = document.createElement("div");
    this.rootWrapper.className = `vr-theme-root vr-pos-${this.config.position || "bottom-right"} vr-animate-enter`;
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
    document.body.appendChild(this.hostElement);
    this.isMounted = true;

    // Track impression
    if (this.analytics) {
      const currentTestimonial = this.testimonials[this.currentIndex];
      this.analytics.track("impression", currentTestimonial?.id);
    }

    // Render collapsed state
    this.renderCollapsed();

    // Listen for Escape key to close/dismiss
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (this.isExpanded) {
          this.collapse();
        } else {
          this.dismiss();
        }
      }
    };
    document.addEventListener("keydown", this.keydownListener);
  }

  /**
   * Renders the collapsed state (floating bubble / bar / story strip).
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
    const position = this.config.position || "bottom-right";

    if (position === "story-strip" && this.testimonials.length > 1) {
      this.renderStoryStrip();
      return;
    }

    const card = document.createElement("div");
    card.className = "vr-collapsed-card";

    // Media preview thumbnail
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "vr-thumb-wrapper";

    if (current.thumbnailUrl) {
      const img = document.createElement("img");
      img.src = current.thumbnailUrl;
      img.alt = current.customerName || "Testimonial";
      thumbWrap.appendChild(img);
    }

    // Play icon badge
    const playBadge = document.createElement("div");
    playBadge.className = "vr-play-badge";
    playBadge.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `;
    thumbWrap.appendChild(playBadge);
    card.appendChild(thumbWrap);

    // Text details
    const info = document.createElement("div");
    info.className = "vr-card-info";

    const name = document.createElement("div");
    name.className = "vr-card-name";
    name.textContent = current.customerName || current.title || "Video Testimonial";
    info.appendChild(name);

    if (current.quote) {
      const quote = document.createElement("div");
      quote.className = "vr-card-quote";
      quote.textContent = `"${current.quote}"`;
      info.appendChild(quote);
    }
    card.appendChild(info);

    // Dismiss button
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

    // On card click: expand
    card.addEventListener("click", () => {
      if (this.analytics) {
        this.analytics.track("click", current.id);
      }
      this.expand(this.currentIndex);
    });

    this.rootWrapper.appendChild(card);
  }

  /**
   * Renders the story-strip variant layout with multiple bubbles.
   */
  private renderStoryStrip(): void {
    if (!this.rootWrapper) return;

    const stripWrapper = document.createElement("div");
    stripWrapper.className = "vr-strip-wrapper";

    this.testimonials.slice(0, 5).forEach((item, idx) => {
      const storyItem = document.createElement("div");
      storyItem.className = "vr-story-item";
      storyItem.setAttribute("title", item.customerName || item.title || "Testimonial");

      if (item.thumbnailUrl) {
        const img = document.createElement("img");
        img.src = item.thumbnailUrl;
        img.alt = item.customerName || "Testimonial";
        storyItem.appendChild(img);
      }

      storyItem.addEventListener("click", () => {
        if (this.analytics) {
          this.analytics.track("click", item.id);
        }
        this.expand(idx);
      });

      stripWrapper.appendChild(storyItem);
    });

    // Close button for strip
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "vr-close-btn";
    closeBtn.style.position = "static";
    closeBtn.setAttribute("aria-label", "Dismiss widget");
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dismiss();
    });
    stripWrapper.appendChild(closeBtn);

    this.rootWrapper.appendChild(stripWrapper);
  }

  /**
   * Expands the widget into full player modal / bottom-sheet.
   */
  public expand(index: number = 0): void {
    if (!this.rootWrapper) return;
    this.isExpanded = true;
    this.currentIndex = index;

    const current = this.testimonials[this.currentIndex];
    if (!current) return;

    this.rootWrapper.innerHTML = "";

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "vr-backdrop";
    backdrop.addEventListener("click", () => this.collapse());
    this.rootWrapper.appendChild(backdrop);

    // Modal dialog
    const modal = document.createElement("div");
    modal.className = `vr-expanded-modal vr-pos-${this.config.position || "bottom-right"}`;

    // Mobile drag grabber
    const grabber = document.createElement("div");
    grabber.className = "vr-sheet-grabber";
    modal.appendChild(grabber);

    // Close button (X)
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

    // Video container
    const playerContainer = document.createElement("div");
    playerContainer.className = "vr-player-container";
    modal.appendChild(playerContainer);

    // Initialize lazy video player
    this.activePlayer = createVideoPlayer({
      container: playerContainer,
      videoUrl: current.videoUrl,
      platform: current.platform,
      thumbnailUrl: current.thumbnailUrl,
      autoplayPreview: this.config.autoplayPreview,
      onPlay: () => {
        if (this.analytics) {
          this.analytics.track("play", current.id);
        }
      },
      onEnded: () => {
        this.next();
      },
    });

    // Content body
    const body = document.createElement("div");
    body.className = "vr-modal-body";

    if (current.quote) {
      const quote = document.createElement("p");
      quote.className = "vr-modal-quote";
      quote.textContent = `"${current.quote}"`;
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

    // Navigation carousel controls if multiple testimonials
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
  }

  /**
   * Advances to next testimonial.
   */
  public next(): void {
    if (this.testimonials.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.testimonials.length;
    this.expand(this.currentIndex);
  }

  /**
   * Goes back to previous testimonial.
   */
  public prev(): void {
    if (this.testimonials.length <= 1) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.testimonials.length) % this.testimonials.length;
    this.expand(this.currentIndex);
  }

  /**
   * Collapses back to small card.
   */
  public collapse(): void {
    if (!this.isExpanded) return;
    this.renderCollapsed();
  }

  /**
   * Dismisses the widget, plays exit animation, removes DOM element,
   * and sets sessionStorage flag to prevent re-show in this session.
   */
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
