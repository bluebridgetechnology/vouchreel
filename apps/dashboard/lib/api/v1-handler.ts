import { NextResponse } from "next/server";
import { authenticateApiKey, ApiKeyContext } from "./api-keys";
import { rateLimit } from "@/lib/rate-limit";
import { apiError, unauthorized } from "@/lib/api/errors";

export const V1_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export interface V1HandlerContext<TParams = Record<string, string>> {
  apiKey: ApiKeyContext;
  corsHeaders: Record<string, string>;
  params?: TParams;
}

export type V1RouteHandler<TParams = Record<string, string>> = (
  request: Request,
  context: V1HandlerContext<TParams>
) => Promise<NextResponse>;

export interface WithApiKeyAuthOptions {
  rateLimitMax?: number; // default 60 requests per minute
  rateLimitWindowMs?: number; // default 60_000 (1 minute)
}

/**
 * Higher-order function wrapping Next.js route handlers for public v1 API routes.
 * Handles:
 * 1. Bearer API key authentication (scoped to space)
 * 2. Per-API-key rate limiting with standard Retry-After headers
 * 3. Permissive CORS headers for public API consumption
 */
export function withApiKeyAuth<TParams = Record<string, string>>(
  handler: V1RouteHandler<TParams>,
  options?: WithApiKeyAuthOptions
) {
  return async (
    request: Request,
    routeProps?: { params?: Promise<TParams> | TParams }
  ) => {
    // 1. Authenticate API Key
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) {
      return unauthorized("Invalid or missing API key", V1_CORS_HEADERS);
    }

    // 2. Enforce Rate Limiting
    const max = options?.rateLimitMax ?? 60;
    const windowMs = options?.rateLimitWindowMs ?? 60_000;
    const limit = rateLimit(`api_${apiKey.apiKeyId}`, { windowMs, max });

    if (!limit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((limit.reset - Date.now()) / 1000)
      );
      return apiError(
        429,
        "RATE_LIMITED",
        "API rate limit exceeded. Please retry later.",
        {
          details: { reset: limit.reset, limit: max },
          headers: {
            ...V1_CORS_HEADERS,
            "Retry-After": retryAfterSec.toString(),
            "X-RateLimit-Limit": max.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": limit.reset.toString(),
          },
        }
      );
    }

    // 3. Resolve route params if provided
    let params: TParams | undefined = undefined;
    if (routeProps?.params) {
      params =
        routeProps.params instanceof Promise
          ? await routeProps.params
          : routeProps.params;
    }

    const rateLimitHeaders: Record<string, string> = {
      ...V1_CORS_HEADERS,
      "X-RateLimit-Limit": max.toString(),
      "X-RateLimit-Remaining": limit.remaining.toString(),
      "X-RateLimit-Reset": limit.reset.toString(),
    };

    // 4. Execute Route Handler
    const response = await handler(request, {
      apiKey,
      corsHeaders: rateLimitHeaders,
      params,
    });

    // Ensure CORS & rate-limit headers are appended to response
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      response.headers.set(key, value);
    }

    return response;
  };
}

/**
 * Standard OPTIONS preflight handler for public v1 API routes.
 */
export function apiV1Options() {
  return async () => {
    return new NextResponse(null, {
      status: 204,
      headers: V1_CORS_HEADERS,
    });
  };
}
