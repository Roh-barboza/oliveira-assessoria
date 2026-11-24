import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/platform/app.mjs";
import { StateRepository } from "../server/platform/store.mjs";
import { SqliteStore } from "../server/platform/sqlite.mjs";
const dir = resolve(process.env.OLIVEIRA_LOCAL_DIR || ".local-platform");
await mkdir(dir, { recursive: true, mode: 0o700 });
const keyFile = resolve(dir, "data.key");
let key;
try {
  key = (await readFile(keyFile, "utf8")).trim();
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  key = randomBytes(32).toString("hex");
  await writeFile(keyFile, key, { mode: 0o600, flag: "wx" });
}
const store = new SqliteStore(resolve(dir, "state.sqlite"));
const app = createApp({
  repository: new StateRepository(store, key),
  storageMode: "sqlite-local-cifrado",
});
const root = resolve("landing"),
  port = Number(process.env.PORT || 4176);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === "/api/plataforma") {
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(!["GET", "HEAD"].includes(req.method)
            ? { body: req, duplex: "half" }
            : {}),
        });
        const response = await app(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      let file = resolve(root, "." + decodeURIComponent(url.pathname));
      if (file !== root && !file.startsWith(root + sep)) throw Error("path");
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(await readFile(resolve(root, "404.html")));
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Plataforma de teste: http://127.0.0.1:${port}/plataforma.html`,
    ),
  );
