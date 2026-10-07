import { MAX_SCRIPT_WORDS, countWords, diffRemovedWords, validateTrim, type DiffToken, type TrimCheck } from "./trim";

/** Shapes the API returns (JSON), shared by the owner UI and its tests. */
export type AiVideoStatus = "draft" | "queued" | "rendering" | "done" | "failed";

export interface AiVideoView {
  id: string;
  status: AiVideoStatus;
  template: string;
  voice: string;
  aspect: "9:16" | "16:9";
  scriptOriginal: string;
  scriptTrimmed: string | null;
  outputUrl: string | null;
  durationSeconds: number | null;
  error: string | null;
  createdAt: string;
  /** Set when a platform administrator took the video down; its file is gone. */
  moderatedAt?: string | null;
  moderationReason?: string | null;
  diff?: DiffToken[] | null;
}

export interface CreditsView {
  /** null = unlimited. 0 = not in the plan. */
  limit: number | null;
  used: number;
  /** null when unlimited (Infinity does not survive JSON). */
  remaining: number | null;
}

export const IN_FLIGHT: AiVideoStatus[] = ["queued", "rendering"];

export const isInFlight = (status: AiVideoStatus) => IN_FLIGHT.includes(status);

/** Poll only while something is being rendered; drafts and finished videos do not change by themselves. */
export const shouldPoll = (videos: Pick<AiVideoView, "status">[]) => videos.some((v) => isInFlight(v.status));

export const STATUS_LABELS: Record<AiVideoStatus, string> = {
  draft: "Needs approval",
  queued: "In the queue",
  rendering: "Creating",
  done: "Ready",
  failed: "Failed",
};

export interface CreditsSummary {
  unlimited: boolean;
  /** True when no new video can be approved. */
  blocked: boolean;
  text: string;
}

export function summarizeCredits(credits: CreditsView): CreditsSummary {
  if (credits.limit === null) return { unlimited: true, blocked: false, text: "Unlimited AI videos on your plan" };
  if (credits.limit === 0) return { unlimited: false, blocked: true, text: "AI video is not included in your plan" };
  const remaining = credits.remaining ?? Math.max(0, credits.limit - credits.used);
  return {
    unlimited: false,
    blocked: remaining <= 0,
    text:
      remaining <= 0
        ? `All ${credits.limit} credits used this month. They reset on the 1st.`
        : `${remaining} of ${credits.limit} credit${credits.limit === 1 ? "" : "s"} left this month`,
  };
}

export interface ScriptReview {
  words: number;
  maxWords: number;
  check: TrimCheck;
  /** True when the script differs from the customer's text (something was removed). */
  trimmed: boolean;
  removedWords: number;
  diff: DiffToken[];
}

/** Live feedback while the owner edits the script, using the same rules the server enforces. */
export function reviewScript(original: string, script: string): ScriptReview {
  const diff = diffRemovedWords(original, script);
  const removedWords = diff.filter((d) => d.removed).length;
  return {
    words: countWords(script),
    maxWords: MAX_SCRIPT_WORDS,
    check: validateTrim(original, script),
    trimmed: removedWords > 0,
    removedWords,
    diff,
  };
}

/** What to open first: a video being created, otherwise the newest draft awaiting approval. */
export function pickActiveVideo(videos: AiVideoView[]): string | null {
  const sorted = [...videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (sorted.find((v) => isInFlight(v.status)) ?? sorted.find((v) => v.status === "draft"))?.id ?? null;
}
