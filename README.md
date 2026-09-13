![](./문화어를-배우자.png)

言語にかなりの興味・関心・情熱がある人のための文化語教材

## 使い方

```sh
npm install     # 最初の一回だけ
npm run start   # http://localhost:3631/ で閲覧
```

`npm run start` は `src/*.md` から `dist/*.html` を生成し、3631 番ポートで配信します。
`src/*.md` や `src/style.css` を保存するとブラウザが自動でリロードします。
配信せずに HTML を書き出すだけなら `npm run build`。

## 構成

| パス | 内容 |
| --- | --- |
| `src/index.md` | 本編（旧タブ1）。`dist/index.html` になる |
| `src/to.md` | 補足教材「토」（旧タブ2）。`dist/to.html` になる |
| `src/style.css` | 見た目。自由に編集してよい（初期状態は Google ドキュメントの書き出しに合わせてある） |
| `src/images/` | 画像 |
| `dist/` | 生成物（git 管理外） |
| `google_docs/` | 移行元の Google ドキュメント書き出し（保存用） |
| `tools/gdocs_to_md.py` | `google_docs/index.html` → `src/index.md`・`src/to.md` の変換スクリプト（移行用。通常は使わない） |

## 原稿の書き方

- ページを増やすときは `src/` に `.md` を足すだけです（`src/foo.md` → `dist/foo.html`）。先頭の `---` … `---` に `title:` を書きます。ページ間のリンクは `<nav class="page-nav">` で。
- 太字は必ず `<b>…</b>` を使います（`**…**` は使いません）。
- 段落内の改行はそのまま `<br>` になります（Google ドキュメントの Shift+Enter と同じ感覚）。空行が段落の区切りです。
- 生 HTML が使えます。`<details class="note"><summary>補足</summary> … </details>` が折りたたみの補足欄です。
  開いた状態にしたければ `<details class="note" open>` とします。
  折りたたまずに囲みたいときは `<div class="note"> … </div>`。
  どちらも中身は空行で挟めば Markdown として書けます。
- 文字色は `<span class="blue">`, `<span class="purple">`, `<span class="gray">`。囲み全体が一色なら `<div class="note purple">` のようにまとめられます。
- 下線は `<u>`。下線の位置は `src/style.css` の `--underline-position`（既定は `under`）で一括調整できます。
- 表は `<table class="grid">`。列幅は `w-sm` / `w-md` / `w-lg`、左に寄せるなら `indent`、灰色のセルは `<td class="blocked">`。
