import { cn } from "@/lib/utils";
import type { DiffToken } from "@/lib/ai-video/trim";

/**
 * The customer's original words with the removed ones struck through, so the owner sees exactly
 * what the video will leave out. Removed text is also announced as "removed" for screen readers.
 */
export function ScriptDiff({ tokens, className }: { tokens: DiffToken[]; className?: string }) {
  return (
    <p className={cn("text-sm leading-relaxed text-text", className)}>
      {tokens.map((token, i) =>
        token.removed ? (
          <del key={i} className="rounded-control bg-danger-soft px-0.5 text-danger-foreground">
            <span className="sr-only">(removed) </span>
            {token.text}
          </del>
        ) : (
          <span key={i}>{token.text}</span>
        ),
      ).flatMap((node, i) => (i === 0 ? [node] : [" ", node]))}
    </p>
  );
}
