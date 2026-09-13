import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getOEmbedMetadata, OEmbedError } from "@/lib/oembed";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/oembed?url=...
 * Proxies and normalizes video metadata from YouTube, Vimeo, or MP4 URLs.
 */
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0].trim() ||
    reqHeaders.get("x-real-ip") ||
    "127.0.0.1";

  // Rate limit: 40 requests per minute per IP
  const rateLimitResult = rateLimit(`oembed:${ip}`, {
    windowMs: 60 * 1000,
    max: 40,
  });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
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
    return NextResponse.json(
      { error: "Missing required 'url' query parameter" },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Unexpected oEmbed proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch video metadata" },
      { status: 500 }
    );
  }
}
