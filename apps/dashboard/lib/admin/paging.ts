/** Last page number for a result set (1 when empty). */
export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Runs a paged query; when the requested page is past the end (a stale link, a filter that now
 * matches less) it runs again for the last page instead of showing an empty table.
 */
export async function clampedPage<T extends { total: number; page: number }>(
  run: (page: number) => Promise<T>,
  page: number,
  pageSize: number
): Promise<T> {
  const result = await run(page);
  const last = lastPage(result.total, pageSize);
  return result.page > last ? run(last) : result;
}
