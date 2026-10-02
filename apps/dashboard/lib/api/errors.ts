import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "PLAN_LIMIT"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

interface ApiErrorOptions {
  details?: unknown;
  headers?: Record<string, string>;
}

/**
 * Standard API error response: { error: { code, message, details? } }
 */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options?: ApiErrorOptions
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options?.details !== undefined ? { details: options.details } : {}),
      },
    },
    { status, headers: options?.headers }
  );
}

export function unauthorized(
  message = "Authentication required",
  headers?: Record<string, string>
) {
  return apiError(401, "UNAUTHORIZED", message, { headers });
}

export function forbidden(
  message = "You do not have access to this resource",
  headers?: Record<string, string>
) {
  return apiError(403, "FORBIDDEN", message, { headers });
}

export function notFound(message = "Resource not found", headers?: Record<string, string>) {
  return apiError(404, "NOT_FOUND", message, { headers });
}

export function validationError(
  message = "Validation failed",
  details?: unknown,
  headers?: Record<string, string>
) {
  return apiError(400, "VALIDATION_ERROR", message, { details, headers });
}

export function badRequest(message = "Bad request", headers?: Record<string, string>) {
  return apiError(400, "BAD_REQUEST", message, { headers });
}

export function internalError(
  message = "Something went wrong on our end",
  headers?: Record<string, string>
) {
  return apiError(500, "INTERNAL_ERROR", message, { headers });
}
