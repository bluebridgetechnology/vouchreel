"use client";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { PerTestimonialStats, SortKey } from "./analytics-types";

interface AnalyticsTableProps {
  rows: PerTestimonialStats[];
  sortedRows: PerTestimonialStats[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}

export function AnalyticsTable({ rows, sortedRows, sortKey, sortAsc, onSort }: AnalyticsTableProps) {
  return (
    <div className="rounded-card border bg-surface p-4">
      <h3 className="mb-4 text-sm font-medium">Per-Testimonial Performance</h3>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-text-muted">
          No testimonials match the active filter.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-text-muted">
                {(
                  [
                    ["title", "Testimonial"],
                    ["impressions", "Impressions"],
                    ["plays", "Plays"],
                    ["clicks", "Clicks"],
                    ["conversions", "Conversions"],
                  ] as Array<[SortKey, string]>
                ).map(([key, label]) => (
                  <th key={key} className="px-2 py-2 font-medium">
                    <button
                      onClick={() => onSort(key)}
                      className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "gap-1 hover:no-underline")}
                    >
                      {label}
                      {sortKey === key && <span>{sortAsc ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.testimonialId} className="border-b last:border-0">
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      {row.thumbnailUrl ? (
                        <img
                          src={row.thumbnailUrl}
                          alt=""
                          className="h-8 w-12 rounded-control object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-12 items-center justify-center rounded-control bg-surface-sunken text-text-muted">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {row.customerName || row.title || "Untitled testimonial"}
                        </p>
                        {row.isActive === false && (
                          <p className="text-2xs text-text-muted">Inactive</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">{row.impressions.toLocaleString()}</td>
                  <td className="px-2 py-2.5">
                    {row.plays.toLocaleString()}
                    {row.impressions > 0 && (
                      <span className="ml-1 text-2xs text-text-muted">
                        ({Math.round((row.plays / row.impressions) * 100)}%)
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">{row.clicks.toLocaleString()}</td>
                  <td className="px-2 py-2.5">{row.conversions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
