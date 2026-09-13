#!/usr/bin/env python3
"""Convert the Google Docs HTML export in google_docs/ into src/index.md.

One-off migration helper, kept in the repo so the conversion can be re-run if
the document is exported from Google Docs again. It is NOT part of the build:
src/index.md is the source of truth once generated.

Google Docs class -> meaning (from the export's <style>):
  c12 bold / c6 bold+underline / c4 underline+gray / c25 underline+blue
  c19 blue / c20 c32 purple / c35 superscript / c17 c28 gray cell background
"""
import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "google_docs" / "index.html"
OUT = ROOT / "src" / "index.md"

VOID = {"img", "br", "hr", "meta", "link", "input"}
BLOCK_TAGS = {"p", "h1", "h2", "h3", "h4", "table", "ol", "ul"}
FRONT_MATTER = "---\ntitle: 문화어를 배우자\nlang: ja\n---\n\n"

NOTE_LABEL = re.compile(
    r'^(?P<open><span class="[a-z]+">)?(?P<label>補足|経緯|実例)[:：][ \t]*'
    r'(?P<tail>[^\n]*)\n?')


class Node:
    def __init__(self, tag, attrs=None, text=None):
        self.tag, self.attrs, self.text, self.kids = tag, attrs or {}, text, []

    def cls(self):
        return set(self.attrs.get("class", "").split())


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].kids.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(Node(tag, dict(attrs)))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].kids.append(Node("#text", text=data))


# ---------------------------------------------------------------- inline text

def esc(text, md):
    """Escape characters that would otherwise be read as Markdown.

    Square brackets are left alone on purpose: the document is full of
    phonetic notation such as [ㄱ], and CommonMark only turns `[x]` into a
    link when `(` or `[` follows it immediately, which never happens here."""
    if not md:
        return html.escape(text, quote=False)
    return re.sub(r"([*`\\])", r"\\\1", text)


def unwrap_link(href):
    if href.startswith("https://www.google.com/url?"):
        q = parse_qs(urlparse(href).query).get("q")
        if q:
            return q[0]
    return href


def inline(node, md=True):
    out = []
    for kid in node.kids:
        if kid.tag == "#text":
            out.append(esc(kid.text.replace("\xa0", " "), md))
        elif kid.tag == "br":
            out.append("\n" if md else "<br>")
        elif kid.tag == "img":
            src = kid.attrs.get("src", "")
            out.append(f"\n![]({src})\n" if md else f'<img src="{src}" alt="">')
        elif kid.tag == "a":
            text = inline(kid, md).strip()
            href = unwrap_link(kid.attrs.get("href", ""))
            if text:
                out.append(f"[{text}]({href})" if md else f'<a href="{href}">{text}</a>')
        elif kid.tag == "span":
            out.append(styled(kid, md))
        else:
            out.append(inline(kid, md))
    return "".join(out)


def styled(node, md):
    c = node.cls()
    body = inline(node, md)
    if not body.strip():
        return body
    if "c12" in c or "c6" in c:
        body = f"**{body}**" if md else f"<strong>{body}</strong>"
    if c & {"c6", "c4", "c25"}:
        body = f"<u>{body}</u>"
    color = ("blue" if c & {"c19", "c25"} else
             "purple" if c & {"c20", "c32"} else
             "gray" if c & {"c4", "c23"} else None)
    if color:
        body = f'<span class="{color}">{body}</span>'
    if "c35" in c:
        body = f"<sup>{body}</sup>"
    return body


LIST_MARKER = re.compile(r"^(\s*)(\d+)([.)])(\s)|^(\s*)([-+>#])(\s)")


def protect_markers(text):
    """Keep lines such as '1) ...' from being read as list/quote markers."""
    def fix(m):
        if m.group(2):
            return f"{m.group(1)}{m.group(2)}\\{m.group(3)}{m.group(4)}"
        return f"{m.group(5)}\\{m.group(6)}{m.group(7)}"
    return "\n".join(LIST_MARKER.sub(fix, line) for line in text.split("\n"))


def para_text(node, md=True):
    text = inline(node, md)
    if md:
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip("\n")
        text = protect_markers(text)
    else:
        text = re.sub(r"(<br>)+$", "", text.strip())
    return text.strip() if not md else text


# --------------------------------------------------------------------- tables

def is_note_box(table):
    rows = [r for r in table.kids if r.tag == "tr"]
    if len(rows) != 1:
        return False
    cells = [c for c in rows[0].kids if c.tag in ("td", "th")]
    return len(cells) == 1 and "c8" in cells[0].cls()


CELL_WIDTH = {"c18": "w-sm", "c17": "w-sm", "c28": "w-sm", "c14": "w-md", "c13": "w-lg"}


def table_classes(table):
    classes = ["grid"]
    first_row = next((r for r in table.kids if r.tag == "tr"), None)
    if first_row:
        widths = {CELL_WIDTH[c] for cell in first_row.kids if cell.tag == "td"
                  for c in cell.cls() & CELL_WIDTH.keys()}
        if len(widths) == 1:
            classes.append(widths.pop())
    if "c11" in table.cls():
        classes.append("indent")
    return " ".join(classes)


def render_table(table):
    lines = [f'<table class="{table_classes(table)}">']
    for row in (r for r in table.kids if r.tag == "tr"):
        lines.append("<tr>")
        for cell in (c for c in row.kids if c.tag in ("td", "th")):
            blocked = ' class="blocked"' if cell.cls() & {"c17", "c28"} else ""
            parts = [para_text(p, md=False) for p in cell.kids if p.tag in ("p", "h2")]
            body = "<br>".join(p for p in parts if p)
            lines.append(f"<td{blocked}>{body}</td>")
        lines.append("</tr>")
    lines.append("</table>")
    return "\n".join(lines)


SPAN = re.compile(r'<span class="(blue|purple|gray)">((?:(?!</?span).)*)</span>', re.S)


def hoist_colour(body):
    """A note box that is entirely one colour keeps the colour on the box
    itself, so the Markdown stays readable."""
    spans = SPAN.findall(body)
    colours = {c for c, _ in spans}
    if len(colours) != 1 or "<span" in SPAN.sub(lambda m: m.group(2), body):
        return body, ""
    # only hoist when every piece of text in the box carries that colour
    leftover = SPAN.sub("", body)
    leftover = re.sub(r"!\[\]\([^)]*\)|<[^>]+>|^\s*\d+\.\s", "", leftover, flags=re.M)
    if leftover.strip():
        return body, ""
    stripped = SPAN.sub(lambda m: m.group(2), body)
    return stripped, " " + colours.pop()


def render_note(table):
    cell = [c for c in table.kids[0].kids if c.tag == "td"][0]
    body = blocks_to_md(cell.kids).strip()
    body, colour = hoist_colour(body)
    match = NOTE_LABEL.match(body)
    if match:
        tail = match.group("tail").strip()
        summary = match.group("label") + (f": {tail}" if 0 < len(tail) <= 50 else "")
        rest = ("" if len(tail) <= 50 else tail + "\n") + body[match.end():]
        if match.group("open"):
            rest = match.group("open") + rest
        return (f'<details class="note{colour}">\n<summary>{summary}</summary>'
                f'\n\n{rest}\n\n</details>')
    return f'<div class="note{colour}">\n\n{body}\n\n</div>'


# --------------------------------------------------------------------- blocks

def blocks_to_md(nodes):
    """Render a run of block-level nodes, merging consecutive non-empty
    paragraphs into one Markdown paragraph (Google Docs paragraphs have no
    margin; an empty paragraph is what creates a visible gap)."""
    out = []          # finished chunks
    para = []         # lines of the paragraph being built
    counter = [0]     # ordered-list numbering across split <ol> runs

    def flush():
        if para:
            out.append("\n".join(para))
            para.clear()

    def in_list():
        return bool(out) and out[-1].startswith(("1. ", "2. ", "3. ", "4. ", "5. ", "6. ", "7. ", "8. ", "9. "))

    for node in nodes:
        if node.tag == "#text":
            if node.text.strip():
                para.append(esc(node.text.strip(), True))
            continue
        if node.tag not in BLOCK_TAGS:
            continue
        cls = node.cls()

        if node.tag in ("h1", "h2", "h3", "h4"):
            flush()
            text = para_text(node)
            level = int(node.tag[1])
            out.append(f"{'#' * level} {text}" if text.strip() and not text.startswith("![](") else text)
            counter[0] = 0
        elif node.tag == "table":
            flush()
            out.append(render_note(node) if is_note_box(node) else render_table(node))
            counter[0] = 0
        elif node.tag in ("ol", "ul"):
            flush()
            if "start" in cls or node.tag == "ul":
                counter[0] = 0
            for li in (k for k in node.kids if k.tag == "li"):
                counter[0] += 1
                text = para_text(li)
                marker = "-  " if node.tag == "ul" else f"{counter[0]}. "
                pad = " " * len(marker)
                body = ("\n" + pad).join(text.split("\n"))
                out.append(f"{marker}{body}")
        else:  # paragraph
            text = para_text(node)
            if "title" in cls:
                flush()
                out.append(f"# {text}")
                counter[0] = 0
            elif not text.strip():
                flush()
            elif "c11" in cls and counter[0] and in_list():
                # continuation of the preceding list item (Docs indents these
                # as separate paragraphs instead of keeping them in the <li>)
                flush()
                pad = " " * len(f"{counter[0]}. ")
                out[-1] += "\n\n" + pad + ("\n" + pad).join(text.split("\n"))
            else:
                if text.startswith("![](") and para:
                    flush()
                para.append(text)
                if text.endswith(")") and text.startswith("![]("):
                    flush()
    flush()
    return "\n\n".join(chunk for chunk in out if chunk.strip())


def main():
    raw = SRC.read_text(encoding="utf-8")
    builder = TreeBuilder()
    builder.feed(raw)

    def find(node, tag):
        if node.tag == tag:
            return node
        for kid in node.kids:
            hit = find(kid, tag)
            if hit:
                return hit
        return None

    body = find(builder.root, "body")
    md = blocks_to_md(body.kids)
    md = FRONT_MATTER + re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    md = "\n".join(line.rstrip() for line in md.split("\n"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(md, encoding="utf-8")
    print(f"wrote {OUT} ({len(md)} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
