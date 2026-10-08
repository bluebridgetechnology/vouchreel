import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

/**
 * A stand-in for Google's sign-in and Business Profile servers, for the browser tests. The app is pointed here with
 * GOOGLE_OAUTH_TEST_ORIGIN. It behaves like the real flow where it matters to us: the consent step sends the
 * browser back with a code and the state untouched, the code only works with the PKCE verifier that matches the
 * challenge, tokens need the app's secret, and the data calls need the access token the refresh produced.
 *   GET  /__state        -> JSON { revoked: [...], authorizeCount }
 *   POST /__deny?on=1|0  -> the next consent screens answer "access denied" (1) or approve (0)
 */
export function startFakeGoogle(port: number, client: { id: string; secret: string }): Promise<Server> {
  const challenges = new Map<string, string>(); // code -> PKCE challenge
  const revoked: string[] = [];
  let authorizeCount = 0;
  let deny = false;
  const refreshToken = "fake-refresh-token";
  const accessToken = "fake-access-token";

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const json = (body: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json").end(JSON.stringify(body));
    };
    const form = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      return new URLSearchParams(Buffer.concat(chunks).toString());
    };
    const authorised = () => req.headers.authorization === `Bearer ${accessToken}`;

    if (url.pathname === "/__state") return json({ revoked, authorizeCount });
    if (url.pathname === "/__deny") {
      deny = url.searchParams.get("on") === "1";
      return json({ deny });
    }

    if (url.pathname === "/authorize") {
      authorizeCount++;
      const q = url.searchParams;
      const back = new URL(q.get("redirect_uri") ?? "");
      back.searchParams.set("state", q.get("state") ?? "");
      if (q.get("client_id") !== client.id || !(q.get("scope") ?? "").includes("business.manage") || q.get("code_challenge_method") !== "S256") {
        back.searchParams.set("error", "invalid_request");
      } else if (deny) {
        back.searchParams.set("error", "access_denied");
      } else {
        const code = `code-${authorizeCount}`;
        challenges.set(code, q.get("code_challenge") ?? "");
        back.searchParams.set("code", code);
      }
      res.statusCode = 302;
      res.setHeader("location", back.toString()).end();
      return;
    }

    if (url.pathname === "/token" && req.method === "POST") {
      const p = await form();
      if (p.get("client_id") !== client.id || p.get("client_secret") !== client.secret) return json({ error: "invalid_client" }, 401);
      if (p.get("grant_type") === "authorization_code") {
        const challenge = challenges.get(p.get("code") ?? "");
        const verifier = p.get("code_verifier") ?? "";
        if (!challenge || createHash("sha256").update(verifier).digest("base64url") !== challenge) return json({ error: "invalid_grant" }, 400);
        challenges.delete(p.get("code") ?? "");
        return json({ access_token: accessToken, refresh_token: refreshToken, expires_in: 3600, scope: "openid https://www.googleapis.com/auth/business.manage" });
      }
      if (p.get("grant_type") === "refresh_token") {
        if (p.get("refresh_token") !== refreshToken || revoked.includes(refreshToken)) return json({ error: "invalid_grant" }, 400);
        return json({ access_token: accessToken, expires_in: 3600 });
      }
      return json({ error: "unsupported_grant_type" }, 400);
    }

    if (url.pathname === "/revoke" && req.method === "POST") {
      revoked.push((await form()).get("token") ?? "");
      return json({});
    }

    if (url.pathname === "/accounts") return authorised() ? json({ accounts: [{ name: "accounts/111", accountName: "E2E Coffee Co" }] }) : json({ error: { message: "unauthenticated" } }, 401);
    if (url.pathname === "/accounts/111/locations") {
      if (!authorised()) return json({ error: { message: "unauthenticated" } }, 401);
      return json({ locations: [{ name: "locations/222", title: "E2E Cafe" }, { name: "locations/333", title: "E2E Bar" }] });
    }
    if (url.pathname === "/accounts/111/locations/222/reviews") {
      if (!authorised()) return json({ error: { message: "unauthenticated" } }, 401);
      return json({
        reviews: [
          { reviewId: "e2e-g1", reviewer: { displayName: "Gwen Googler" }, starRating: "FIVE", comment: "The best flat white in town, and the staff remember your name.", createTime: "2026-02-01T09:00:00Z" },
          { reviewId: "e2e-g2", reviewer: { displayName: "Gus Guest" }, starRating: "FOUR", comment: "(Translated by Google) Lovely place (Original) Un endroit charmant", createTime: "2026-02-02T09:00:00Z" },
        ],
        averageRating: 4.5,
        totalReviewCount: 2,
      });
    }
    json({ error: { message: `no such fake route ${url.pathname}` } }, 404);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
