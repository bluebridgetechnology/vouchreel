import { createServer, type Server } from "node:http";

/**
 * A just-enough S3 for the browser tests. It accepts DELETE (a takedown), remembers the keys, and can be
 * told to fail so the retry path can be exercised. It also stands in for direct-to-storage uploads:
 * browser form POSTs (with the size range from the signed policy enforced), HEAD, GET with Range, and the
 * CORS answers a browser on another origin needs.
 *   GET  /__deleted        -> JSON list of deleted keys (bucket prefix removed)
 *   GET  /__objects        -> JSON list of stored keys
 *   POST /__fail?on=1|0    -> make every DELETE return 500 (1) or succeed (0)
 */
export function startFakeS3(port: number, bucket: string): Promise<Server> {
  const deleted: string[] = [];
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  let failing = false;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    // A browser page on another origin needs these on every answer, and a preflight reply
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-expose-headers", "ETag");
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-methods", "GET, POST, PUT, HEAD, DELETE").statusCode = 204;
      res.end();
      return;
    }
    if (url.pathname === "/__objects") {
      res.setHeader("content-type", "application/json").end(JSON.stringify([...objects.keys()]));
      return;
    }
    // Browser form upload: POST to the bucket with a multipart body, the file last
    if (req.method === "POST" && (url.pathname === `/${bucket}` || url.pathname === `/${bucket}/`)) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      try {
        const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": String(req.headers["content-type"]) } }).formData();
        const key = String(form.get("key") ?? "");
        const file = form.get("file");
        const policy = JSON.parse(Buffer.from(String(form.get("Policy") ?? ""), "base64").toString() || "{}");
        const range = (policy.conditions ?? []).find((c: unknown) => Array.isArray(c) && c[0] === "content-length-range") as [string, number, number] | undefined;
        if (!key || !(file instanceof File) || !range || file.size < range[1] || file.size > range[2]) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/xml").end("<Error><Code>EntityTooLarge</Code></Error>");
          return;
        }
        objects.set(key, { body: Buffer.from(await file.arrayBuffer()), contentType: String(form.get("Content-Type") ?? "") });
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 400;
        res.end();
      }
      return;
    }
    if ((req.method === "HEAD" || req.method === "GET") && url.pathname.startsWith(`/${bucket}/`)) {
      const stored = objects.get(decodeURIComponent(url.pathname.slice(bucket.length + 2)));
      if (!stored) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader("content-type", stored.contentType || "application/octet-stream");
      const match = /^bytes=(\d+)-(\d+)?$/.exec(String(req.headers.range ?? ""));
      if (match && req.method === "GET") {
        const part = stored.body.subarray(Number(match[1]), match[2] ? Number(match[2]) + 1 : undefined);
        res.statusCode = 206;
        res.setHeader("content-length", part.length).end(part);
        return;
      }
      res.setHeader("content-length", stored.body.length);
      res.end(req.method === "HEAD" ? undefined : stored.body);
      return;
    }
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
      const gone = decodeURIComponent(url.pathname.slice(bucket.length + 2));
      deleted.push(gone);
      objects.delete(gone);
      res.statusCode = 204;
      res.end();
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
