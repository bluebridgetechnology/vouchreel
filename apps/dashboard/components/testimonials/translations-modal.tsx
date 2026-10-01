"use client";

import { useEffect, useState } from "react";
import { TestimonialItem } from "./testimonial-card";

export interface TranslationItem {
  id: string;
  testimonialId: string;
  language: string;
  quote: string | null;
  transcript: Array<{ start: number; end: number; text: string }> | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Spanish (Español)", flag: "🇪🇸" },
  { code: "fr", label: "French (Français)", flag: "🇫🇷" },
  { code: "de", label: "German (Deutsch)", flag: "🇩🇪" },
  { code: "it", label: "Italian (Italiano)", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese (Português)", flag: "🇵🇹" },
  { code: "ja", label: "Japanese (日本語)", flag: "🇯🇵" },
  { code: "zh", label: "Chinese (中文)", flag: "🇨🇳" },
  { code: "nl", label: "Dutch (Nederlands)", flag: "🇳🇱" },
  { code: "ar", label: "Arabic (العربية)", flag: "🇸🇦" },
];

interface TranslationsModalProps {
  spaceId: string;
  testimonial: TestimonialItem;
  isOpen: boolean;
  onClose: () => void;
}

export function TranslationsModal({
  spaceId,
  testimonial,
  isOpen,
  onClose,
}: TranslationsModalProps) {
  const [translations, setTranslations] = useState<TranslationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState<string>("es");
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch translations on modal open
  useEffect(() => {
    if (!isOpen || !testimonial) return;

    let isMounted = true;
    async function loadTranslations() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/spaces/${spaceId}/testimonials/${testimonial.id}/translations`
        );
        if (!res.ok) {
          throw new Error("Failed to load translations");
        }
        const data = await res.json();
        if (isMounted) {
          const list: TranslationItem[] = data.translations || [];
          setTranslations(list);
          if (list.length > 0) {
            setSelectedLang(list[0].language);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error fetching translations");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTranslations();

    return () => {
      isMounted = false;
    };
  }, [isOpen, spaceId, testimonial]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !translating) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, translating, onClose]);

  if (!isOpen) return null;

  async function handleAutoTranslate() {
    if (!targetLang) return;
    setTranslating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/testimonials/${testimonial.id}/translations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: targetLang }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Translation request failed");
      }

      const data = await res.json();
      const newTranslation: TranslationItem = data.translation;

      // Update state: replace if exists, otherwise append
      setTranslations((prev) => {
        const exists = prev.some((t) => t.language.toLowerCase() === newTranslation.language.toLowerCase());
        if (exists) {
          return prev.map((t) =>
            t.language.toLowerCase() === newTranslation.language.toLowerCase() ? newTranslation : t
          );
        }
        return [...prev, newTranslation];
      });

      setSelectedLang(newTranslation.language);
      setSuccessMessage(
        `Successfully translated into ${
          SUPPORTED_LANGUAGES.find((l) => l.code === newTranslation.language)?.label ||
          newTranslation.language.toUpperCase()
        }!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  const activeTranslation = translations.find(
    (t) => t.language.toLowerCase() === selectedLang?.toLowerCase()
  );

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="translations-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
            </div>
            <div>
              <h3 id="translations-modal-title" className="text-base font-bold text-foreground">
                Multi-Language Captions & Translations
              </h3>
              <p className="text-xs text-muted-foreground">
                {testimonial.customerName
                  ? `Captions for ${testimonial.customerName}`
                  : "Auto-translate captions and quotes for global visitors"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Notification Banners */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Source Content Preview */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <span>🇺🇸</span> English [Source]
              </span>
              <span className="text-[11px] text-muted-foreground">Original Text</span>
            </div>
            {testimonial.quote ? (
              <p className="text-xs italic text-foreground">"{testimonial.quote}"</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No source quote text provided.</p>
            )}
          </div>

          {/* Action: Auto-translate New Language */}
          <div className="rounded-xl border p-4 bg-card space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Add or Refresh Translation
            </h4>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                disabled={translating}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const alreadyCached = translations.some((t) => t.language.toLowerCase() === lang.code);
                  return (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label} {alreadyCached ? "(cached)" : ""}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={handleAutoTranslate}
                disabled={translating}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
              >
                {translating ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Translating...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Auto-translate
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Translations are generated via configured translation adapters (DeepL, Google Translate, or Mock) and cached in the database for instant visitor delivery.
            </p>
          </div>

          {/* Cached Translations Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Available Cached Translations ({translations.length})
              </h4>
            </div>

            {loading ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
            ) : translations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                No translations generated yet. Choose a language above and click "Auto-translate".
              </div>
            ) : (
              <div className="space-y-4">
                {/* Language Select Tabs */}
                <div className="flex flex-wrap gap-2">
                  {translations.map((item) => {
                    const meta = SUPPORTED_LANGUAGES.find((l) => l.code === item.language.toLowerCase());
                    const isSelected = selectedLang?.toLowerCase() === item.language.toLowerCase();
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedLang(item.language)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                            : "border-border bg-card text-foreground hover:bg-accent"
                        }`}
                      >
                        <span>{meta?.flag || "🌐"}</span>
                        <span>{meta?.label.split(" ")[0] || item.language.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Translation Detail & Preview */}
                {activeTranslation && (
                  <div className="rounded-xl border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground uppercase">
                          {activeTranslation.language} Translation
                        </span>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          Provider: {activeTranslation.provider}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Cached: {new Date(activeTranslation.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Translated Quote */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Translated Quote
                      </label>
                      <div className="rounded-md bg-muted/40 p-3 text-xs italic text-foreground">
                        "{activeTranslation.quote || 'No translated quote'}"
                      </div>
                    </div>

                    {/* Translated Transcript Cues */}
                    {activeTranslation.transcript &&
                    Array.isArray(activeTranslation.transcript) &&
                    activeTranslation.transcript.length > 0 ? (
                      <div className="space-y-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Subtitle Cues ({activeTranslation.transcript.length})
                        </label>
                        <div className="max-h-40 overflow-y-auto rounded-md border divide-y text-xs">
                          {activeTranslation.transcript.map((cue, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-2 bg-background hover:bg-muted/30">
                              <span className="font-mono text-[10px] text-muted-foreground pt-0.5 whitespace-nowrap">
                                {formatTime(cue.start)} - {formatTime(cue.end)}
                              </span>
                              <span className="text-foreground">{cue.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        No subtitle cues stored for this testimonial.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t bg-muted/20 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border bg-background px-4 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
