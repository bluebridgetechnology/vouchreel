import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, cspHeaderName, cspMode, makeNonce, storageOrigin } from "@/lib/security/csp";

/**
 * Runs before every page request: makes a fresh nonce, puts the Content Security Policy built around it on
 * the request (so Next.js stamps the nonce onto its own scripts and styles) and on the response.
 * See lib/security/csp.ts for the stages (CSP_MODE).
 */
export function proxy(request: NextRequest) {
  const mode = cspMode();
  if (mode === "off") return NextResponse.next();

  const nonce = makeNonce();
  const policy = buildCsp({ nonce, dev: process.env.NODE_ENV === "development", storage: storageOrigin() });
  const header = cspHeaderName(mode);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(header, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, build files, images or anything with a file extension
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
