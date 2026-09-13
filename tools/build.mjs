// Renders every src/*.md page into dist/<name>.html, subsets the fonts in
// font/ down to the characters the pages actually use, and copies the assets
// next to them.  Run directly (`npm run build`) or import build() from the
// dev server.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import subsetFont from "subset-font";
import { transliterate } from "../custom-transliteration/transliterate.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = path.join(ROOT, "src");
export const DIST = path.join(ROOT, "dist");
const FONT_SRC = path.join(ROOT, "font");
const FONT_CACHE = path.join(ROOT, ".cache", "fonts");

// html: true  -> <details>/<summary> and the tables in index.md pass through
// breaks: true -> a newline is a <br>, matching how the Google Docs source
//                 used soft line breaks inside a paragraph
const md = new MarkdownIt({ html: true, breaks: true, linkify: false });

// ---------------------------------------------------------------- fonts

// Hangul syllables, both jamo blocks and the compatibility jamo (ㄱ, ㅏ …)
// that the text uses constantly.  Anything outside this range falls through
// to the Japanese face in the family stack.
const HANGUL_RANGE = "U+1100-11FF, U+3130-318F, U+A960-A97F, U+AC00-D7FF";
const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿]/;

// Always keep these, whatever the pages happen to contain today.
const ALWAYS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@[]^_`{|}~" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "→←…—–「」『』《》｢｣、。，．・：；？！％＋－（）［］【】〜※°ə";

// scope "body"   -> the bulk text          scope "sample" -> :<: s … :>: regions
// script "ja"    -> everything but Hangul  script "ko"    -> Hangul only
const FONTS = [
  {
    family: "TextbookJa",
    weight: 400,
    file: "SourceHanSansJP-Normal.otf",
    name: "source-han-sans-jp",
    scope: "body",
    script: "ja",
  },
  {
    family: "TextbookKo",
    weight: 400,
    file: "KP-CheonRiMa-KCC.ttf",
    name: "kp-cheonrima",
    scope: "body",
    script: "ko",
    unicodeRange: HANGUL_RANGE,
  },
  {
    family: "SampleJa",
    weight: 400,
    file: "SourceHanSerifJP-Regular.otf",
    name: "source-han-serif-jp",
    scope: "sample",
    script: "ja",
  },
  {
    family: "SampleJa",
    weight: 700,
    file: "SourceHanSerifJP-Bold.otf",
    name: "source-han-serif-jp-bold",
    scope: "sample",
    script: "ja",
  },
  // CheongPong only ships a Bold cut; declaring it for both weights keeps the
  // browser from synthesising a second, heavier one for <b>.
  {
    family: "SampleKo",
    weight: 400,
    file: "KCC-KP-CheongPong-Bold-KP-2011KPS.ttf",
    name: "kp-cheongpong-bold",
    scope: "sample",
    script: "ko",
    unicodeRange: HANGUL_RANGE,
  },
  {
    family: "SampleKo",
    weight: 700,
    file: "KCC-KP-CheongPong-Bold-KP-2011KPS.ttf",
    name: "kp-cheongpong-bold",
    scope: "sample",
    script: "ko",
    unicodeRange: HANGUL_RANGE,
  },
];

const charsFor = (font, chars) =>
  [...chars[font.scope]]
    .filter((c) => (font.script === "ko" ? HANGUL_RE.test(c) : !HANGUL_RE.test(c)))
    .sort()
    .join("");

// Subsetting a CJK font takes a second or two, so keep the results in
// .cache/fonts/ keyed by the source file and the exact character set.
async function subsetToCache(font, text) {
  const source = path.join(FONT_SRC, font.file);
  const stat = fs.statSync(source);
  const key = crypto
    .createHash("sha256")
    .update(`${font.file}:${stat.size}:${stat.mtimeMs}:${text}`)
    .digest("hex")
    .slice(0, 8);
  const cached = path.join(FONT_CACHE, `${font.name}.${key}.woff2`);
  if (!fs.existsSync(cached)) {
    fs.mkdirSync(FONT_CACHE, { recursive: true });
    const woff2 = await subsetFont(fs.readFileSync(source), text, { targetFormat: "woff2" });
    fs.writeFileSync(cached, woff2);
  }
  return { cached, file: `${font.name}.${key}.woff2` };
}

// Writes dist/fonts/*.woff2 and returns the generated @font-face stylesheet.
async function buildFonts(chars) {
  const outDir = path.join(DIST, "fonts");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const rules = [];
  const done = new Map(); // one download per physical font file
  for (const font of FONTS) {
    const text = charsFor(font, chars);
    if (!done.has(font.name)) {
      const { cached, file } = await subsetToCache(font, text);
      fs.copyFileSync(cached, path.join(outDir, file));
      done.set(font.name, file);
    }
    rules.push(
      [
        "@font-face {",
        `  font-family: "${font.family}";`,
        `  src: url("fonts/${done.get(font.name)}") format("woff2");`,
        `  font-weight: ${font.weight};`,
        "  font-style: normal;",
        "  font-display: swap;",
        ...(font.unicodeRange ? [`  unicode-range: ${font.unicodeRange};`] : []),
        "}",
      ].join("\n"),
    );
  }
  return `/* Generated by tools/build.mjs — do not edit; run \`npm run build\`.
   Sources live in font/, subset to the characters used by src/*.md. */\n\n${rules.join(
    "\n\n",
  )}\n`;
}

// ---------------------------------------------------------------- markdown

// A region opens with `:<: kind [題名]` and closes with `:>:`, so the pages
// need no closing tag of their own.  `open` may use the rest of the opening
// line; `close` is pushed on a stack and emitted by the matching `:>:`, which
// is what makes the regions nest.  `scope: "sample"` also switches the fonts.
const BLOCKS = {
  // 例文: serif + CheongPong
  s: { open: () => '<div class="sample">', close: "</div>", scope: "sample" },
  // 囲み（見出しなし）
  box: { open: () => '<div class="note">', close: "</div>" },
  // 折りたたみの補足欄。b-open is the same box, open on arrival.
  b: {
    open: (title) => `<details class="note"><summary>${title}</summary>`,
    close: "</details>",
    title: true,
  },
  "b-open": {
    open: (title) => `<details class="note" open><summary>${title}</summary>`,
    close: "</details>",
    title: true,
  },
};

const OPEN_FENCE = /^:<:[ \t]+([A-Za-z][\w-]*)[ \t]*(.*?)[ \t]*$/;
const CLOSE_FENCE = /^:>:[ \t]*$/;

// Turns the fences into HTML and, along the way, records which characters
// appear inside a sample region and which appear in the bulk text.
function preprocess(body, page, offset = 0) {
  const chars = { body: new Set(ALWAYS), sample: new Set(ALWAYS) };
  const stack = [];
  const scope = () => (stack.length ? stack[stack.length - 1].scope : "body");
  const note = (text) => {
    for (const c of text) chars[scope()].add(c);
  };

  const out = body.split(/\r?\n/).map((line, i) => {
    const where = `${page}:${i + 1 + offset}`;
    const opening = OPEN_FENCE.exec(line);
    if (opening) {
      const [, kind, title] = opening;
      const block = BLOCKS[kind];
      if (!block) {
        throw new Error(
          `${where}: 知らない囲み \`:<: ${kind}\` です（使えるのは ${Object.keys(BLOCKS)
            .map((k) => `\`${k}\``)
            .join(", ")}）`,
        );
      }
      if (block.title && !title) {
        throw new Error(`${where}: \`:<: ${kind}\` には見出しが要ります（例: \`:<: ${kind} 補足\`）`);
      }
      note(title);
      stack.push({ close: block.close, scope: block.scope || scope() });
      return block.open(title);
    }
    if (CLOSE_FENCE.test(line)) {
      const frame = stack.pop();
      if (!frame) throw new Error(`${where}: 対応する \`:<:\` のない \`:>:\` です`);
      return frame.close;
    }
    note(line);
    return line;
  });

  if (stack.length) {
    throw new Error(`${page}: 閉じられていない \`:<:\` が ${stack.length} 個あります`);
  }
  return { markdown: out.join("\n"), chars };
}

function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, body: text, offset: 0 };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2];
  }
  // so that fence errors can be reported with the line number in the file
  const offset = (match[0].match(/\n/g) || []).length;
  return { meta, body: text.slice(match[0].length), offset };
}

const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ------------------------------------------------------- hover romanization

// A "word" is a run of Hangul — syllable blocks or lone jamo — held together
// by the 사이표 that the textbook writes inside words (기'발, 나무''잎).
const HANGUL_WORD = /[가-힣ㄱ-ㅣ][가-힣ㄱ-ㅣ'’]*/g;

// Gives every Hangul word a data-translit attribute carrying its
// transliteration, which style.css shows as a bubble on hover.  This walks the
// rendered HTML rather than the Markdown so that the raw tables in the pages
// are covered too; everything between "<" and ">" is copied through untouched,
// which keeps tags and attributes out of reach.
//
// The bubble is drawn by the page itself, so the letters it needs (ŏ, ŭ, ⟨ ⟩ …)
// are added to `chars` — otherwise the subset fonts would not carry them.
function annotateHangul(html, chars) {
  const wrapWords = (text) =>
    text.replace(HANGUL_WORD, (word) => {
      // a trailing 사이표 belongs to the punctuation, not to the word
      const trimmed = word.replace(/['’]+$/, "");
      const rest = word.slice(trimmed.length);
      const roman = transliterate(trimmed);
      for (const c of roman) {
        chars.body.add(c);
        chars.sample.add(c);
      }
      return `<span class="translit" data-translit="${escapeHtml(roman)}">${trimmed}</span>${rest}`;
    });

  let out = "";
  let at = 0;
  while (at < html.length) {
    const tagStart = html.indexOf("<", at);
    if (tagStart === -1) {
      out += wrapWords(html.slice(at));
      break;
    }
    out += wrapWords(html.slice(at, tagStart));
    const tagEnd = html.indexOf(">", tagStart);
    if (tagEnd === -1) {
      out += html.slice(tagStart); // unterminated "<": leave it alone
      break;
    }
    out += html.slice(tagStart, tagEnd + 1);
    at = tagEnd + 1;
  }
  return out;
}

export const pages = () => fs.readdirSync(SRC).filter((f) => f.endsWith(".md"));

export function renderPage(name) {
  const { meta, body, offset } = frontMatter(fs.readFileSync(path.join(SRC, name), "utf8"));
  const { markdown, chars } = preprocess(body, name, offset);
  const title = meta.title || "문화어를 배우자";
  const html = `<!doctype html>
<html lang="${meta.lang || "ja"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main class="doc-content">
${annotateHangul(md.render(markdown), chars)}</main>
</body>
</html>
`;
  return { html, chars };
}

function copyAssets() {
  fs.mkdirSync(DIST, { recursive: true });
  fs.copyFileSync(path.join(SRC, "style.css"), path.join(DIST, "style.css"));
  fs.cpSync(path.join(SRC, "images"), path.join(DIST, "images"), { recursive: true });
}

export async function build() {
  fs.mkdirSync(DIST, { recursive: true });
  const chars = { body: new Set(), sample: new Set() };
  const written = pages().map((name) => {
    const out = path.join(DIST, name.replace(/\.md$/, ".html"));
    const page = renderPage(name);
    fs.writeFileSync(out, page.html);
    for (const scope of ["body", "sample"]) {
      for (const c of page.chars[scope]) chars[scope].add(c);
    }
    return out;
  });
  fs.writeFileSync(path.join(DIST, "fonts.css"), await buildFonts(chars));
  copyAssets();
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const out of await build()) console.log(`built ${path.relative(ROOT, out)}`);
}
