/** One cell of CSV, quoted when needed, and defanged against spreadsheet formulas (a cell starting with = + - @ is read as a formula). */
export function csvCell(value: unknown): string {
  let text = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV document: header row then data rows, CRLF line ends, every cell quoted when needed and defanged against spreadsheet formulas. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** A download response for a CSV document; never cached, since it holds customer account data. */
export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
