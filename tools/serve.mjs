// Dev server: rebuilds dist/ whenever a source file changed, serves it on
// http://localhost:3631 and reloads the browser tab on edits to any of
// src/*.md, src/style.css or src/images/.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { build, DIST, ROOT, SRC, pages } from "./build.mjs";

const PORT = Number(process.env.PORT) || 3631;
const watched = () => [
  ...pages().map((f) => path.join(SRC, f)),
  path.join(SRC, "style.css"),
  ...fs.readdirSync(path.join(SRC, "images")).map((f) => path.join(SRC, "images", f)),
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".woff2": "font/woff2",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const stamp = () =>
  watched()
    .map((f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0))
    .join("-");

let lastStamp = "";
let building = null;
async function rebuildIfStale() {
  const now = stamp();
  if (now === lastStamp) return building;
  lastStamp = now;
  building = build().then(() => {
    console.log(`[${new Date().toLocaleTimeString()}] rebuilt`);
  });
  return building;
}

const LIVE_RELOAD = `
<script>
(function poll(last) {
  fetch("/__stamp").then(r => r.text()).then(s => {
    if (last && s !== last) return location.reload();
    setTimeout(() => poll(s), 500);
  }).catch(() => setTimeout(() => poll(last), 2000));
})("");
</script>
`;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/__stamp") {
      await rebuildIfStale();
      res.writeHead(200, { "content-type": "text/plain" }).end(lastStamp);
      return;
    }
    await rebuildIfStale();

    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404");
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    if (type.startsWith("text/html")) {
      const html = fs.readFileSync(file, "utf8").replace("</body>", `${LIVE_RELOAD}</body>`);
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(html);
      return;
    }
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, async () => {
    lastStamp = stamp();
    await build();
    console.log(`${path.relative(process.cwd(), ROOT) || "."} -> http://localhost:${PORT}/`);
  });
