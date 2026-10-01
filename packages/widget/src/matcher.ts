export interface MatchRules {
  mode?: "all" | "specific" | string;
  urlPatterns?: string[];
  tags?: string[];
  [key: string]: unknown;
}

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

export interface TestimonialTranslation {
  language: string;
  quote?: string | null;
  transcript?: Array<TranscriptCue> | null;
}

export interface TestimonialItem {
  id: string;
  videoUrl: string;
  platform: "youtube" | "vimeo" | "mp4" | string;
  thumbnailUrl?: string | null;
  title?: string | null;
  quote?: string | null;
  customerName?: string | null;
  customerCompany?: string | null;
  durationSeconds?: number | null;
  matchRules?: MatchRules | null;
  tags?: string[] | null;
  sortOrder?: number;
  translations?:
    | TestimonialTranslation[]
    | Record<string, { quote?: string | null; transcript?: Array<TranscriptCue> | null }>;
  [key: string]: unknown;
}

/**
 * Detects visitor locale via navigator.language or document.documentElement.lang.
 */
export function detectVisitorLocale(): string {
  if (typeof document !== "undefined" && document.documentElement?.lang) {
    const docLang = document.documentElement.lang.trim().slice(0, 2).toLowerCase();
    if (docLang) return docLang;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.slice(0, 2).toLowerCase();
  }
  return "en";
}

/**
 * Finds matching translation for a testimonial in the visitor's language.
 * Returns null if no translation exists for the language.
 */
export function resolveTestimonialTranslation(
  testimonial: TestimonialItem,
  targetLang: string
): TestimonialTranslation | null {
  if (!testimonial || !testimonial.translations) return null;
  const lang = targetLang.trim().toLowerCase();

  if (Array.isArray(testimonial.translations)) {
    const found = testimonial.translations.find(
      (t) => t.language?.trim().toLowerCase() === lang
    );
    return found || null;
  }

  if (typeof testimonial.translations === "object") {
    const entry = (testimonial.translations as Record<string, any>)[lang];
    if (entry) {
      return {
        language: lang,
        quote: entry.quote ?? null,
        transcript: entry.transcript ?? null,
      };
    }
  }

  return null;
}

export interface WidgetTargetingConfig {
  pagesIncluded?: string[];
  pagesExcluded?: string[];
  [key: string]: unknown;
}

/**
 * Normalizes a URL path by removing trailing slashes, query strings, and hash fragments.
 */
export function normalizePath(inputPath: string): string {
  if (!inputPath) return "/";
  // Remove query string and hash
  let clean = inputPath.split("?")[0].split("#")[0].trim();
  // Remove trailing slash unless it's just "/"
  if (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  // Ensure leading slash
  if (!clean.startsWith("/")) {
    clean = "/" + clean;
  }
  return clean;
}

/**
 * Converts a glob pattern (with * and **) into a RegExp.
 * - `*` matches any characters within a single path segment (excluding `/`).
 * - `**` matches any characters across path segments (including `/`).
 */
export function globToRegex(pattern: string): RegExp {
  const normalizedPattern = normalizePath(pattern);

  // If pattern is wildcard
  if (normalizedPattern === "/*" || normalizedPattern === "/**") {
    return /^.*$/;
  }

  // Escape special regex characters except *
  let regexStr = "";
  let i = 0;
  while (i < normalizedPattern.length) {
    const char = normalizedPattern[i];
    if (char === "*" && normalizedPattern[i + 1] === "*") {
      // ** matches any characters across multiple segments
      regexStr += ".*";
      i += 2;
    } else if (char === "*") {
      // * matches characters within a single segment
      regexStr += "[^/]+";
      i += 1;
    } else if (["\\", ".", "^", "$", "+", "?", "(", ")", "[", "]", "{", "}", "|"].includes(char)) {
      regexStr += "\\" + char;
      i += 1;
    } else {
      regexStr += char;
      i += 1;
    }
  }

  // Allow optional trailing slash at the end
  return new RegExp(`^${regexStr}(?:/)?$`, "i");
}

/**
 * Tests if a given pathname matches a single glob or exact pattern.
 */
export function matchPattern(pattern: string, pathname: string): boolean {
  if (!pattern) return false;
  const trimmed = pattern.trim();
  if (trimmed === "*" || trimmed === "/*" || trimmed === "/**") return true;

  const normalized = normalizePath(pathname);
  const regex = globToRegex(trimmed);
  return regex.test(normalized);
}

/**
 * Matches host page tags against required tags.
 * Returns true if required tags are empty, or if at least one required tag is present in host tags.
 */
export function matchTags(requiredTags?: string[] | null, hostTags?: string[] | null): boolean {
  if (!requiredTags || requiredTags.length === 0) {
    return true;
  }
  if (!hostTags || hostTags.length === 0) {
    return false;
  }

  const normalizedHostTags = hostTags.map((t) => t.trim().toLowerCase());
  return requiredTags.some((tag) =>
    normalizedHostTags.includes(tag.trim().toLowerCase())
  );
}

/**
 * Extracts host page tags from document if in a browser environment.
 * Checks `data-vouchreel-tags` attribute on <body> or meta tag.
 */
export function getHostPageTags(): string[] {
  if (typeof document === "undefined") return [];

  const bodyTags = document.body?.getAttribute("data-vouchreel-tags");
  if (bodyTags) {
    return bodyTags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const metaTag = document.querySelector('meta[name="vouchreel-tags"]');
  if (metaTag) {
    const content = metaTag.getAttribute("content");
    if (content) {
      return content.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  return [];
}

/**
 * Checks if the current page is allowed by the widget config's page targeting rules.
 */
export function isPageAllowed(config?: WidgetTargetingConfig, pathname: string = "/"): boolean {
  if (!config) return true;

  const cleanPath = normalizePath(pathname);

  // Check exclusions first
  if (config.pagesExcluded && config.pagesExcluded.length > 0) {
    for (const pattern of config.pagesExcluded) {
      if (pattern && matchPattern(pattern, cleanPath)) {
        return false;
      }
    }
  }

  // Check inclusions
  if (config.pagesIncluded && config.pagesIncluded.length > 0) {
    const hasWildcard = config.pagesIncluded.some(
      (p) => p === "*" || p === "/*" || p === "/**"
    );
    if (hasWildcard) {
      return true;
    }

    return config.pagesIncluded.some((pattern) => matchPattern(pattern, cleanPath));
  }

  return true;
}

/**
 * Filters testimonials based on match rules and the current URL/page context.
 */
export function filterTestimonials(
  testimonials: TestimonialItem[],
  location: { pathname: string; href?: string } = { pathname: "/" },
  hostTags: string[] = getHostPageTags()
): TestimonialItem[] {
  if (!Array.isArray(testimonials) || testimonials.length === 0) {
    return [];
  }

  const currentPath = normalizePath(location.pathname);

  return testimonials.filter((item) => {
    const rules = item.matchRules;

    // If no rules or mode is "all", always include
    if (!rules || !rules.mode || rules.mode === "all") {
      return true;
    }

    if (rules.mode === "specific") {
      let matchesUrl = false;
      if (Array.isArray(rules.urlPatterns) && rules.urlPatterns.length > 0) {
        matchesUrl = rules.urlPatterns.some((pattern) =>
          matchPattern(pattern, currentPath)
        );
      } else {
        // If specific mode but no urlPatterns, treat as matching path
        matchesUrl = true;
      }

      const matchesTag = matchTags(rules.tags, hostTags);

      return matchesUrl && matchesTag;
    }

    return true;
  });
}

export interface ReviewItem {
  id: string;
  provider: "google" | "trustpilot" | string;
  authorName: string;
  authorPhotoUrl?: string | null;
  rating: number;
  text?: string | null;
  reviewDate?: string | Date | null;
  matchRules?: MatchRules | null;
  tags?: string[] | null;
  [key: string]: unknown;
}

/**
 * Filters text reviews based on match rules and current URL/page context.
 */
export function filterReviews(
  reviews: ReviewItem[],
  location: { pathname: string; href?: string } = { pathname: "/" },
  hostTags: string[] = getHostPageTags()
): ReviewItem[] {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return [];
  }

  const currentPath = normalizePath(location.pathname);

  return reviews.filter((item) => {
    const rules = item.matchRules;

    if (!rules || !rules.mode || rules.mode === "all") {
      return true;
    }

    if (rules.mode === "specific") {
      let matchesUrl = false;
      if (Array.isArray(rules.urlPatterns) && rules.urlPatterns.length > 0) {
        matchesUrl = rules.urlPatterns.some((pattern) =>
          matchPattern(pattern, currentPath)
        );
      } else {
        matchesUrl = true;
      }

      const matchesTag = matchTags(rules.tags, hostTags);

      return matchesUrl && matchesTag;
    }

    return true;
  });
}

