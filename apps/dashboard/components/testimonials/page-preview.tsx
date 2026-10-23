"use client";

import { useMemo, useState } from "react";
import { filterTestimonials, type TestimonialItem as MatchItem } from "@vouchreel/widget/matcher";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/input";

interface PreviewItem {
  id: string;
  title: string | null;
  customerName: string | null;
  isActive: boolean;
  matchRules: unknown;
}

/**
 * "What shows on this page?" The owner types a page path (and optional page tags) and sees which testimonials the
 * widget would pick, using the widget's own matcher so the answer cannot drift from what visitors get.
 */
export function PagePreview({ items }: { items: PreviewItem[] }) {
  const [path, setPath] = useState("/");
  const [tagText, setTagText] = useState("");

  const { shown, hidden } = useMemo(() => {
    const live = items.filter((t) => t.isActive);
    const tags = tagText.split(",").map((t) => t.trim()).filter(Boolean);
    // Accept a pasted full URL as well as a path
    let pathname = path.trim() || "/";
    try {
      if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
    } catch {}
    const matched = new Set(
      filterTestimonials(live.map((t) => ({ id: t.id, matchRules: t.matchRules }) as MatchItem), { pathname }, tags).map((t) => t.id)
    );
    return { shown: live.filter((t) => matched.has(t.id)), hidden: live.filter((t) => !matched.has(t.id)) };
  }, [items, path, tagText]);

  const label = (t: PreviewItem) => t.title || t.customerName || "Video testimonial";

  return (
    <Card variant="flat" className="space-y-4 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-text">Preview by page</h3>
        <p className="text-xs text-text-muted">Enter a page on your site to see which testimonials its visitors would get.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="preview-path" className="text-xs font-medium text-text">Page</label>
          <input id="preview-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/pricing" className={`${inputClass} w-full text-xs`} />
        </div>
        <div className="space-y-1">
          <label htmlFor="preview-tags" className="text-xs font-medium text-text">Page tags (optional, comma separated)</label>
          <input id="preview-tags" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="enterprise, saas" className={`${inputClass} w-full text-xs`} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
        <div>
          <p className="text-xs font-medium text-text">Shown here ({shown.length})</p>
          <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
            {shown.length === 0 && <li>Nothing. Visitors on this page would see no videos.</li>}
            {shown.map((t) => (
              <li key={t.id} className="truncate">{label(t)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-text">Hidden here ({hidden.length})</p>
          <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
            {hidden.length === 0 && <li>None. Every active testimonial shows.</li>}
            {hidden.map((t) => (
              <li key={t.id} className="truncate">{label(t)}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
