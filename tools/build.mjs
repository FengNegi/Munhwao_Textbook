// Renders every src/*.md page into dist/<name>.html and copies the assets
// next to them.  Run directly (`npm run build`) or import build() from the
// dev server.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = path.join(ROOT, "src");
export const DIST = path.join(ROOT, "dist");

// html: true  -> <details>/<summary> and the tables in index.md pass through
// breaks: true -> a newline is a <br>, matching how the Google Docs source
//                 used soft line breaks inside a paragraph
const md = new MarkdownIt({ html: true, breaks: true, linkify: false });

function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: text.slice(match[0].length) };
}

const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const pages = () => fs.readdirSync(SRC).filter((f) => f.endsWith(".md"));

export function renderPage(name) {
  const { meta, body } = frontMatter(fs.readFileSync(path.join(SRC, name), "utf8"));
  const title = meta.title || "문화어를 배우자";
  return `<!doctype html>
<html lang="${meta.lang || "ja"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main class="doc-content">
${md.render(body)}</main>
</body>
</html>
`;
}

function copyAssets() {
  fs.mkdirSync(DIST, { recursive: true });
  fs.copyFileSync(path.join(SRC, "style.css"), path.join(DIST, "style.css"));
  fs.cpSync(path.join(SRC, "images"), path.join(DIST, "images"), { recursive: true });
}

export function build() {
  fs.mkdirSync(DIST, { recursive: true });
  const written = pages().map((name) => {
    const out = path.join(DIST, name.replace(/\.md$/, ".html"));
    fs.writeFileSync(out, renderPage(name));
    return out;
  });
  copyAssets();
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const out of build()) console.log(`built ${path.relative(ROOT, out)}`);
}
