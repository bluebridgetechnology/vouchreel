export type VideoPlatform = "youtube" | "vimeo" | "mp4";

export interface NormalizedOEmbedResponse {
  platform: VideoPlatform;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  embedUrl: string;
}

export class OEmbedError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "OEmbedError";
    this.statusCode = statusCode;
  }
}

/**
 * Checks if a host/IP is a private or loopback address (SSRF protection).
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  ) {
    return true;
  }

  // IPv4 regex checks for private network ranges
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 169.254.0.0/16 (link-local)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;

  return false;
}

/**
 * Validates the URL and ensures it doesn't target internal networks.
 */
export function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OEmbedError("Invalid URL provided", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new OEmbedError("Only HTTP and HTTPS URLs are supported", 400);
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new OEmbedError("Access to internal/private addresses is prohibited", 400);
  }

  return parsed;
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
export function extractYouTubeId(parsedUrl: URL): string | null {
  const host = parsedUrl.hostname.toLowerCase();

  // youtu.be/<id>
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const id = parsedUrl.pathname.slice(1).split("/")[0];
    return id && id.length > 0 ? id : null;
  }

  // youtube.com
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    // /watch?v=<id>
    if (parsedUrl.pathname === "/watch") {
      return parsedUrl.searchParams.get("v");
    }
    // /embed/<id>
    if (parsedUrl.pathname.startsWith("/embed/")) {
      return parsedUrl.pathname.split("/")[2] || null;
    }
    // /shorts/<id>
    if (parsedUrl.pathname.startsWith("/shorts/")) {
      return parsedUrl.pathname.split("/")[2] || null;
    }
    // /v/<id>
    if (parsedUrl.pathname.startsWith("/v/")) {
      return parsedUrl.pathname.split("/")[2] || null;
    }
  }

  return null;
}

/**
 * Extracts Vimeo video ID from Vimeo URL formats.
 */
export function extractVimeoId(parsedUrl: URL): string | null {
  const host = parsedUrl.hostname.toLowerCase();
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    // Matches /123456789 or /channels/staffpicks/123456789 or /video/123456789
    const match = parsedUrl.pathname.match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Detects video platform from URL.
 */
export function detectPlatform(parsedUrl: URL): VideoPlatform {
  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname.toLowerCase();

  if (
    host === "youtu.be" ||
    host.endsWith(".youtu.be") ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com")
  ) {
    return "youtube";
  }

  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    return "vimeo";
  }

  if (path.endsWith(".mp4") || parsedUrl.search.includes(".mp4")) {
    return "mp4";
  }

  throw new OEmbedError(
    "Unsupported platform. Please provide a YouTube, Vimeo, or MP4 URL.",
    400
  );
}

/**
 * Fetches and normalizes metadata for YouTube videos.
 */
async function fetchYouTubeMetadata(
  url: string,
  parsedUrl: URL
): Promise<NormalizedOEmbedResponse> {
  const videoId = extractYouTubeId(parsedUrl);
  const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    url
  )}&format=json`;

  try {
    const res = await fetch(oembedEndpoint);
    if (res.status === 404) {
      throw new OEmbedError("YouTube video not found or is private", 404);
    }
    if (!res.ok) {
      throw new OEmbedError("Failed to fetch YouTube oEmbed metadata", res.status);
    }

    const data = await res.json();
    const embedUrl = videoId
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : `https://www.youtube-nocookie.com/embed/`;

    return {
      platform: "youtube",
      title: data.title || "YouTube Testimonial",
      thumbnailUrl:
        data.thumbnail_url ||
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
      durationSeconds: null,
      embedUrl,
    };
  } catch (err) {
    if (err instanceof OEmbedError) throw err;
    throw new OEmbedError("Failed to reach YouTube oEmbed service", 502);
  }
}

/**
 * Fetches and normalizes metadata for Vimeo videos.
 */
async function fetchVimeoMetadata(
  url: string,
  parsedUrl: URL
): Promise<NormalizedOEmbedResponse> {
  const videoId = extractVimeoId(parsedUrl);
  const oembedEndpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
    url
  )}`;

  try {
    const res = await fetch(oembedEndpoint);
    if (res.status === 404) {
      throw new OEmbedError("Vimeo video not found or is private", 404);
    }
    if (!res.ok) {
      throw new OEmbedError("Failed to fetch Vimeo oEmbed metadata", res.status);
    }

    const data = await res.json();
    const id = data.video_id?.toString() || videoId;
    const embedUrl = id
      ? `https://player.vimeo.com/video/${id}`
      : url;

    return {
      platform: "vimeo",
      title: data.title || "Vimeo Testimonial",
      thumbnailUrl: data.thumbnail_url || null,
      durationSeconds: typeof data.duration === "number" ? Math.round(data.duration) : null,
      embedUrl,
    };
  } catch (err) {
    if (err instanceof OEmbedError) throw err;
    throw new OEmbedError("Failed to reach Vimeo oEmbed service", 502);
  }
}

/**
 * Probes and formats metadata for direct MP4 video URLs.
 */
async function fetchMp4Metadata(
  url: string,
  parsedUrl: URL
): Promise<NormalizedOEmbedResponse> {
  let filename = "Video Testimonial";
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  if (pathSegments.length > 0) {
    const rawFilename = pathSegments[pathSegments.length - 1];
    const clean = rawFilename.replace(/\.mp4$/i, "").replace(/[-_]/g, " ");
    if (clean.length > 0) {
      filename = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  // Attempt HEAD request to check availability
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.status === 404) {
      throw new OEmbedError("MP4 video not found", 404);
    }
  } catch (err) {
    if (err instanceof OEmbedError) throw err;
    // Non-fatal if HEAD fails (some servers block HEAD), continue with defaults
  }

  // Default video placeholder SVG encoded
  const placeholderThumbnail =
    "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20640%20360%22%20fill%3D%22%231e293b%22%3E%3Crect%20width%3D%22640%22%20height%3D%22360%22%2F%3E%3Cpolygon%20points%3D%22270%2C130%20410%2C180%20270%2C230%22%20fill%3D%22%2394a3b8%22%2F%3E%3C%2Fsvg%3E";

  return {
    platform: "mp4",
    title: filename,
    thumbnailUrl: placeholderThumbnail,
    durationSeconds: null,
    embedUrl: url,
  };
}

/**
 * Main function: Given a video URL, validates, detects platform, and fetches normalized metadata.
 */
export async function getOEmbedMetadata(url: string): Promise<NormalizedOEmbedResponse> {
  const parsedUrl = validateUrl(url);
  const platform = detectPlatform(parsedUrl);

  switch (platform) {
    case "youtube":
      return fetchYouTubeMetadata(url, parsedUrl);
    case "vimeo":
      return fetchVimeoMetadata(url, parsedUrl);
    case "mp4":
      return fetchMp4Metadata(url, parsedUrl);
  }
}
