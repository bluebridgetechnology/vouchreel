import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { FunnelStep, OverviewStats, PerTestimonialStats } from "./queries";

export interface ReportBranding {
  isWhiteLabeled: boolean;
  brandName?: string;
  brandColor?: string;
  logoUrl?: string;
}

export interface ExecutiveReportData {
  spaceName: string;
  spaceId: string;
  dateRange: { start: Date; end: Date };
  generatedAt: Date;
  branding: ReportBranding;
  stats: OverviewStats;
  funnel: FunnelStep[];
  testimonials: PerTestimonialStats[];
}

function hexToRgb(hex?: string) {
  if (!hex) return rgb(0.31, 0.27, 0.9); // default indigo
  const clean = hex.replace("#", "");
  const num = parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean,
    16
  );
  if (isNaN(num)) return rgb(0.31, 0.27, 0.9);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

function sanitizeText(str: string): string {
  return str
    .replace(/[→⇒]/g, "->")
    .replace(/[•]/g, "*")
    .replace(/[−–—]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

function truncate(str: string, maxLen: number): string {
  const s = sanitizeText(str);
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generates an executive summary PDF report using pure-JS pdf-lib.
 * Completely compatible with Vercel serverless, Edge, and Docker standalone.
 */
export async function generateExecutivePdf(
  data: ExecutiveReportData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = hexToRgb(data.branding.brandColor);
  const darkColor = rgb(0.06, 0.09, 0.16);
  const mutedColor = rgb(0.39, 0.45, 0.55);
  const cardBg = rgb(0.97, 0.98, 0.99);
  const borderCol = rgb(0.88, 0.91, 0.94);
  const headerBg = rgb(0.94, 0.96, 0.98);

  const startX = 40;
  const contentWidth = 515;

  // 1. Top Accent Bar
  page.drawRectangle({
    x: 0,
    y: 835,
    width: 595.28,
    height: 7,
    color: primaryColor,
  });

  // 2. Header
  const titleText = data.branding.isWhiteLabeled
    ? `${data.branding.brandName || data.spaceName} - Executive Analytics`
    : "VouchReel - Executive Analytics Report";

  page.drawText(sanitizeText(titleText), {
    x: startX,
    y: 795,
    size: 18,
    font: fontBold,
    color: darkColor,
  });

  const badgeText = data.branding.isWhiteLabeled
    ? data.branding.brandName?.toUpperCase() || "EXECUTIVE SUMMARY"
    : "VOUCHREEL ANALYTICS";

  page.drawText(sanitizeText(badgeText), {
    x: startX + contentWidth - 140,
    y: 798,
    size: 8,
    font: fontBold,
    color: primaryColor,
  });

  const subtitle = `Space: ${data.spaceName}   |   Period: ${formatDate(
    data.dateRange.start
  )} to ${formatDate(data.dateRange.end)}   |   Generated: ${formatDate(
    data.generatedAt
  )}`;

  page.drawText(sanitizeText(subtitle), {
    x: startX,
    y: 775,
    size: 8.5,
    font,
    color: mutedColor,
  });

  page.drawLine({
    start: { x: startX, y: 760 },
    end: { x: startX + contentWidth, y: 760 },
    thickness: 1,
    color: borderCol,
  });

  // 3. Summary Stats Cards (2x3 grid)
  page.drawText("Key Performance Overview", {
    x: startX,
    y: 740,
    size: 11,
    font: fontBold,
    color: darkColor,
  });

  const playRate =
    data.stats.impressions > 0
      ? Math.round((data.stats.plays / data.stats.impressions) * 100)
      : 0;
  const conversionRate =
    data.stats.impressions > 0
      ? Math.round((data.stats.conversions / data.stats.impressions) * 100)
      : 0;

  const cards = [
    { label: "Total Impressions", value: data.stats.impressions.toLocaleString() },
    { label: "Video Plays", value: data.stats.plays.toLocaleString() },
    { label: "Play Rate", value: `${playRate}%` },
    { label: "Total Clicks", value: data.stats.clicks.toLocaleString() },
    { label: "Conversions", value: data.stats.conversions.toLocaleString() },
    { label: "Conversion Rate", value: `${conversionRate}%` },
  ];

  const cardW = (contentWidth - 20) / 3;
  const cardH = 44;

  cards.forEach((card, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const cx = startX + col * (cardW + 10);
    const cy = 680 - row * (cardH + 10);

    page.drawRectangle({
      x: cx,
      y: cy,
      width: cardW,
      height: cardH,
      color: cardBg,
      borderColor: borderCol,
      borderWidth: 1,
    });

    page.drawText(sanitizeText(card.label), {
      x: cx + 10,
      y: cy + cardH - 14,
      size: 7.5,
      font,
      color: mutedColor,
    });

    page.drawText(sanitizeText(card.value), {
      x: cx + 10,
      y: cy + 10,
      size: 14,
      font: fontBold,
      color: darkColor,
    });
  });

  // 4. Conversion Funnel Table
  const funnelY = 590;
  page.drawText("Conversion Funnel Breakdown", {
    x: startX,
    y: funnelY,
    size: 11,
    font: fontBold,
    color: darkColor,
  });

  const fTableY = funnelY - 26;
  page.drawRectangle({
    x: startX,
    y: fTableY,
    width: contentWidth,
    height: 20,
    color: headerBg,
  });

  page.drawText("Funnel Stage", {
    x: startX + 10,
    y: fTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Volume", {
    x: startX + 160,
    y: fTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Conversion From Previous", {
    x: startX + 260,
    y: fTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Drop-Off Rate", {
    x: startX + 410,
    y: fTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });

  const stepLabels: Record<string, string> = {
    impression: "1. Impressions",
    play: "2. Video Plays",
    click: "3. Clicks",
    convert: "4. Conversions",
  };

  data.funnel.forEach((step, idx) => {
    const rowY = fTableY - 20 * (idx + 1);

    page.drawLine({
      start: { x: startX, y: rowY },
      end: { x: startX + contentWidth, y: rowY },
      thickness: 0.5,
      color: borderCol,
    });

    page.drawText(sanitizeText(stepLabels[step.step] || step.step), {
      x: startX + 10,
      y: rowY + 5,
      size: 8,
      font,
      color: darkColor,
    });
    page.drawText(step.count.toLocaleString(), {
      x: startX + 160,
      y: rowY + 5,
      size: 8,
      font: fontBold,
      color: darkColor,
    });
    page.drawText(
      step.conversionFromPrevious !== null
        ? `${step.conversionFromPrevious}%`
        : "100% (Baseline)",
      {
        x: startX + 260,
        y: rowY + 5,
        size: 8,
        font,
        color: darkColor,
      }
    );
    page.drawText(
      step.dropOffPercent !== null ? `-${step.dropOffPercent}%` : "0%",
      {
        x: startX + 410,
        y: rowY + 5,
        size: 8,
        font,
        color: step.dropOffPercent && step.dropOffPercent > 0 ? rgb(0.8, 0.2, 0.2) : mutedColor,
      }
    );
  });

  // 5. Top Performing Testimonials Table
  const topY = 460;
  page.drawText("Top Performing Testimonials", {
    x: startX,
    y: topY,
    size: 11,
    font: fontBold,
    color: darkColor,
  });

  const tTableY = topY - 26;
  page.drawRectangle({
    x: startX,
    y: tTableY,
    width: contentWidth,
    height: 20,
    color: headerBg,
  });

  page.drawText("Testimonial / Customer", {
    x: startX + 10,
    y: tTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Impressions", {
    x: startX + 220,
    y: tTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Plays", {
    x: startX + 295,
    y: tTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Clicks", {
    x: startX + 365,
    y: tTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });
  page.drawText("Conversions", {
    x: startX + 435,
    y: tTableY + 6,
    size: 8,
    font: fontBold,
    color: mutedColor,
  });

  const sortedTestimonials = [...data.testimonials]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  if (sortedTestimonials.length === 0) {
    page.drawText("No testimonial events recorded in this period.", {
      x: startX + 10,
      y: tTableY - 18,
      size: 8,
      font,
      color: mutedColor,
    });
  } else {
    sortedTestimonials.forEach((item, idx) => {
      const rowY = tTableY - 22 * (idx + 1);

      page.drawLine({
        start: { x: startX, y: rowY },
        end: { x: startX + contentWidth, y: rowY },
        thickness: 0.5,
        color: borderCol,
      });

      const title = truncate(
        item.customerName || item.title || "Untitled Testimonial",
        30
      );

      page.drawText(title, {
        x: startX + 10,
        y: rowY + 6,
        size: 8,
        font,
        color: darkColor,
      });
      page.drawText(item.impressions.toLocaleString(), {
        x: startX + 220,
        y: rowY + 6,
        size: 8,
        font,
        color: darkColor,
      });
      page.drawText(item.plays.toLocaleString(), {
        x: startX + 295,
        y: rowY + 6,
        size: 8,
        font,
        color: darkColor,
      });
      page.drawText(item.clicks.toLocaleString(), {
        x: startX + 365,
        y: rowY + 6,
        size: 8,
        font,
        color: darkColor,
      });
      page.drawText(item.conversions.toLocaleString(), {
        x: startX + 435,
        y: rowY + 6,
        size: 8,
        font: fontBold,
        color: darkColor,
      });
    });
  }

  // 6. Footer with White-labeling Guarantee
  page.drawLine({
    start: { x: startX, y: 55 },
    end: { x: startX + contentWidth, y: 55 },
    thickness: 1,
    color: borderCol,
  });

  const footerText = data.branding.isWhiteLabeled
    ? `${data.branding.brandName || data.spaceName} Executive Performance Report * Confidential`
    : "Generated by VouchReel Analytics * www.vouchreel.com * Confidential";

  page.drawText(sanitizeText(footerText), {
    x: startX,
    y: 40,
    size: 7.5,
    font,
    color: mutedColor,
  });

  page.drawText("Page 1 of 1", {
    x: startX + contentWidth - 45,
    y: 40,
    size: 7.5,
    font,
    color: mutedColor,
  });

  return pdfDoc.save();
}

/**
 * Generates an executive printable HTML report with @media print CSS styles.
 */
export function generateExecutiveHtml(data: ExecutiveReportData): string {
  const brandTitle = data.branding.isWhiteLabeled
    ? data.branding.brandName || data.spaceName
    : "VouchReel";

  const brandColor = data.branding.brandColor || "#4f46e5";

  const playRate =
    data.stats.impressions > 0
      ? Math.round((data.stats.plays / data.stats.impressions) * 100)
      : 0;
  const conversionRate =
    data.stats.impressions > 0
      ? Math.round((data.stats.conversions / data.stats.impressions) * 100)
      : 0;

  const sortedTestimonials = [...data.testimonials]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.spaceName} - Executive Analytics Report</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #f8fafc; color: #0f172a; padding: 24px; max-width: 800px; margin: 0 auto; }
    .report-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 6px; }
    .badge { background: ${brandColor}15; color: ${brandColor}; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin: 24px 0 12px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .kpi-label { font-size: 11px; color: #64748b; font-weight: 500; }
    .kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { text-align: left; padding: 8px 12px; background: #f1f5f9; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .dropoff-negative { color: #dc2626; font-weight: 500; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .report-card { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
    <button onclick="window.print()" style="padding: 8px 16px; background: ${brandColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
      Print / Save as PDF
    </button>
  </div>
  <div class="report-card">
    <div class="header">
      <div>
        <h1 class="title">${brandTitle} Performance Report</h1>
        <p class="subtitle">
          Space: <strong>${data.spaceName}</strong> &bull; Period: ${formatDate(data.dateRange.start)} to ${formatDate(data.dateRange.end)} &bull; Generated: ${formatDate(data.generatedAt)}
        </p>
      </div>
      <div>
        <span class="badge">${data.branding.isWhiteLabeled ? (data.branding.brandName || "Executive Report") : "VouchReel Analytics"}</span>
      </div>
    </div>

    <div class="section-title">Key Performance Indicators</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Impressions</div>
        <div class="kpi-value">${data.stats.impressions.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Video Plays</div>
        <div class="kpi-value">${data.stats.plays.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Play Rate</div>
        <div class="kpi-value">${playRate}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Clicks</div>
        <div class="kpi-value">${data.stats.clicks.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Conversions</div>
        <div class="kpi-value">${data.stats.conversions.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Conversion Rate</div>
        <div class="kpi-value">${conversionRate}%</div>
      </div>
    </div>

    <div class="section-title">Conversion Funnel Performance</div>
    <table>
      <thead>
        <tr>
          <th>Stage</th>
          <th>Events</th>
          <th>From Previous</th>
          <th>Drop-Off</th>
        </tr>
      </thead>
      <tbody>
        ${data.funnel
          .map(
            (step) => `<tr>
          <td><strong>${step.step.charAt(0).toUpperCase() + step.step.slice(1)}</strong></td>
          <td>${step.count.toLocaleString()}</td>
          <td>${step.conversionFromPrevious !== null ? `${step.conversionFromPrevious}%` : "100%"}</td>
          <td class="${step.dropOffPercent && step.dropOffPercent > 0 ? "dropoff-negative" : ""}">${step.dropOffPercent !== null ? `-${step.dropOffPercent}%` : "0%"}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <div class="section-title">Top Performing Testimonials</div>
    <table>
      <thead>
        <tr>
          <th>Testimonial / Customer</th>
          <th>Impressions</th>
          <th>Plays</th>
          <th>Clicks</th>
          <th>Conversions</th>
        </tr>
      </thead>
      <tbody>
        ${
          sortedTestimonials.length === 0
            ? `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">No events recorded in this period.</td></tr>`
            : sortedTestimonials
                .map(
                  (t) => `<tr>
          <td><strong>${t.customerName || t.title || "Untitled Testimonial"}</strong></td>
          <td>${t.impressions.toLocaleString()}</td>
          <td>${t.plays.toLocaleString()}</td>
          <td>${t.clicks.toLocaleString()}</td>
          <td><strong>${t.conversions.toLocaleString()}</strong></td>
        </tr>`
                )
                .join("")
        }
      </tbody>
    </table>

    <div class="footer">
      <div>${
        data.branding.isWhiteLabeled
          ? `${data.branding.brandName || data.spaceName} Executive Performance Report &bull; Strictly Confidential`
          : `Generated by VouchReel Analytics &bull; www.vouchreel.com &bull; Confidential`
      }</div>
      <div>Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}
