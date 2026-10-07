import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getOEmbedMetadata, OEmbedError } from "@/lib/oembed";
import { rateLimit } from "@/lib/rate-limit";
import {
  apiError,
  badRequest,
  internalError,
  type ApiErrorCode,
} from "@/lib/api/errors";
import { getClientIp } from "@/lib/security/client-ip";
import { log } from "@/lib/log";

/**
 * GET /api/oembed?url=...
 * Proxies and normalizes video metadata from YouTube, Vimeo, or MP4 URLs.
 */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);

  // Rate limit: 40 requests per minute per IP
  const rateLimitResult = await rateLimit(`oembed:${ip}`, {
    windowMs: 60 * 1000,
    max: 40,
  });

  if (!rateLimitResult.success) {
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please try again later.",
      {
        headers: {
          "Retry-After": Math.ceil(
            (rateLimitResult.reset - Date.now()) / 1000
          ).toString(),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || typeof url !== "string" || !url.trim()) {
    return badRequest("Missing required 'url' query parameter");
  }

  try {
    const metadata = await getOEmbedMetadata(url.trim());
    return NextResponse.json(metadata, {
      status: 200,
      headers: {
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      },
    });
  } catch (error) {
    if (error instanceof OEmbedError) {
      const code: ApiErrorCode =
        error.statusCode === 401
          ? "UNAUTHORIZED"
          : error.statusCode === 403
            ? "FORBIDDEN"
            : error.statusCode === 404
              ? "NOT_FOUND"
              : error.statusCode === 429
                ? "RATE_LIMITED"
                : error.statusCode >= 500
                  ? "INTERNAL_ERROR"
                  : "BAD_REQUEST";

      return apiError(error.statusCode, code, error.message);
    }

    log.error("Unexpected oEmbed proxy error:", error);
    return internalError("Failed to fetch video metadata");
  }
}
