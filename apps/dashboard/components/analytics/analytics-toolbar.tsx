"use client";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { RANGE_OPTIONS, type CompareMode, type PerTestimonialStats } from "./analytics-types";
import { Card } from "@/components/ui/card";

interface AnalyticsToolbarProps {
  spaceId: string;
  days: number;
  loading: boolean;
  exportCsvUrl: string;
  exportPdfUrl: string;
  rows: PerTestimonialStats[];
  trafficSources: string[];
  selectedTestimonial: string;
  selectedDevice: string;
  selectedTrafficSource: string;
  searchPageUrl: string;
  hasActiveFilters: boolean;
  compareMode: CompareMode;
  onRangeChange: (days: number) => void;
  setSelectedTestimonial: (v: string) => void;
  setSelectedDevice: (v: string) => void;
  setSelectedTrafficSource: (v: string) => void;
  setSearchPageUrl: (v: string) => void;
  setCompareMode: (v: CompareMode) => void;
  onResetFilters: () => void;
}

export function AnalyticsToolbar({
  spaceId, days, loading, exportCsvUrl, exportPdfUrl, rows, trafficSources,
  selectedTestimonial, selectedDevice, selectedTrafficSource, searchPageUrl, hasActiveFilters, compareMode,
  onRangeChange, setSelectedTestimonial, setSelectedDevice, setSelectedTrafficSource, setSearchPageUrl, setCompareMode, onResetFilters,
}: AnalyticsToolbarProps) {
  return (
    <>
  {/* Top action & date header */}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs text-text-muted">
          Track impressions, video plays, click-throughs, and conversions with multi-dimensional segmentation.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range picker buttons */}
        <div className="flex gap-1 rounded-control border p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onRangeChange(opt.days)}
              disabled={loading}
              className={cn("rounded-control px-2.5 py-1 text-xs font-medium transition-colors", toggleStyle("solid", days === opt.days))}
            >
              {opt.label}
            </button>
          ))}
        </div>
  
        {/* Export buttons */}
        <a
          href={exportCsvUrl}
          download={`vouchreel-analytics-${spaceId}.csv`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          title="Export raw analytics data to CSV"
        >
          <svg
            className="h-3.5 w-3.5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export CSV
        </a>
  
        <a
          href={exportPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "primary", size: "sm" })}
          title="Download executive summary PDF report"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          Download PDF Report
        </a>
      </div>
    </div>
  
    {/* Filter and Comparison Bar */}
    <Card variant="flat" className="flex flex-wrap items-center justify-between gap-3 p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-2xs font-medium text-text-muted">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filters:
        </span>
  
        {/* Testimonial Filter */}
        <select
          value={selectedTestimonial}
          onChange={(e) => setSelectedTestimonial(e.target.value)}
          className={cn(inputClass, "h-8 text-xs")}
        >
          <option value="">All Testimonials</option>
          {rows.map((row) => (
            <option key={row.testimonialId} value={row.testimonialId}>
              {row.customerName || row.title || "Untitled Testimonial"}
            </option>
          ))}
        </select>
  
        {/* Device Filter */}
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className={cn(inputClass, "h-8 text-xs")}
        >
          <option value="">All Devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
        </select>
  
        {/* Traffic Source Filter */}
        <select
          value={selectedTrafficSource}
          onChange={(e) => setSelectedTrafficSource(e.target.value)}
          className={cn(inputClass, "h-8 text-xs")}
        >
          <option value="">All Traffic Sources</option>
          <option value="direct">Direct</option>
          {trafficSources
            .filter((src) => src !== "direct")
            .map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
        </select>
  
        {/* Page URL Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Filter by Page URL..."
            value={searchPageUrl}
            onChange={(e) => setSearchPageUrl(e.target.value)}
            className={cn(inputClass, "h-8 w-44 text-xs")}
          />
        </div>
  
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Reset Filters
          </button>
        )}
      </div>
  
      {/* Compare Toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-2xs font-medium text-text-muted">Compare:</span>
        <div className="inline-flex rounded-control border p-0.5">
          <button
            onClick={() => setCompareMode("none")}
            className={cn("rounded-control px-2 py-0.5 text-xs font-medium transition-colors", toggleStyle("solid", compareMode === "none"))}
          >
            Off
          </button>
          <button
            onClick={() => setCompareMode("previous")}
            className={cn("rounded-control px-2 py-0.5 text-xs font-medium transition-colors", toggleStyle("solid", compareMode === "previous"))}
          >
            Previous Period
          </button>
          <button
            onClick={() => setCompareMode("segments")}
            className={cn("rounded-control px-2 py-0.5 text-xs font-medium transition-colors", toggleStyle("solid", compareMode === "segments"))}
          >
            Mobile vs Desktop
          </button>
        </div>
      </div>
    </Card>
    </>
  );
}
