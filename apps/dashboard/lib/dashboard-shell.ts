/** The cookie that remembers whether the sidebar is collapsed to its icon rail, so the server renders it that way from the first byte. */
export const SIDEBAR_COOKIE = "vr-sidebar";

/**
 * Pages that are a canvas rather than a document: the widget editor, where the preview wants every pixel. On
 * them the sidebar starts as its icon rail (the owner can open it) and the page has no width limit.
 */
export function isCanvasPath(pathname: string): boolean {
  return /^\/spaces\/[^/]+\/widget\/[^/]+\/?$/.test(pathname);
}
