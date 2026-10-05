import type { ApiErrorCode } from "@/lib/api/errors";

/** Expected failures of the generate flow, mapped to API errors by the routes. */
export class AiVideoError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "AiVideoError";
  }
}
