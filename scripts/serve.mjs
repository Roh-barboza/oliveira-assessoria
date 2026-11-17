import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.env.SITE_ROOT || "landing");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
export const server = http.createServer(async (req, res) => {
  let file;
  try {
    file = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
    );
    if (file !== root && !file.startsWith(root + sep))
      throw Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      await readFile(resolve(root, "404.html")).catch(() =>
        Buffer.from("Not found"),
      ),
    );
  }
});
server.listen(Number(process.env.PORT || 4175), "127.0.0.1", () =>
  console.log(`Site: http://127.0.0.1:${server.address().port}`),
);
