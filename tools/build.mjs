// Renders src/index.md into dist/index.html and copies the assets next to it.
// Run directly (`npm run build`) or import renderPage() from the dev server.
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

export function renderPage() {
  const { meta, body } = frontMatter(fs.readFileSync(path.join(SRC, "index.md"), "utf8"));
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
  fs.writeFileSync(path.join(DIST, "index.html"), renderPage());
  copyAssets();
  return path.join(DIST, "index.html");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`built ${path.relative(ROOT, build())}`);
}
