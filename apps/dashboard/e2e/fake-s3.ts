import { createServer, type Server } from "node:http";

/**
 * A just-enough S3 for the moderation tests: it accepts DELETE (the only call a takedown makes),
 * remembers the keys, and can be told to fail so the retry path can be exercised.
 *   GET  /__deleted        -> JSON list of deleted keys (bucket prefix removed)
 *   POST /__fail?on=1|0    -> make every DELETE return 500 (1) or succeed (0)
 */
export function startFakeS3(port: number, bucket: string): Promise<Server> {
  const deleted: string[] = [];
  let failing = false;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/__deleted") {
      res.setHeader("content-type", "application/json").end(JSON.stringify(deleted));
      return;
    }
    if (url.pathname === "/__fail") {
      failing = url.searchParams.get("on") === "1";
      res.end("ok");
      return;
    }
    if (req.method === "DELETE" && url.pathname.startsWith(`/${bucket}/`)) {
      if (failing) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/xml").end("<Error><Code>InternalError</Code><Message>fake storage is down</Message></Error>");
        return;
      }
      deleted.push(decodeURIComponent(url.pathname.slice(bucket.length + 2)));
      res.statusCode = 204;
      res.end();
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
