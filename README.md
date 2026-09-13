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

公開版: https://fengnegi.github.io/Munhwao_Textbook/
`main` に push すると GitHub Actions (`.github/workflows/deploy.yml`) がビルドして GitHub Pages に配信します。

## 構成

| パス | 内容 |
| --- | --- |
| `src/index.md` | 本編（旧タブ1）。`dist/index.html` になる |
| `src/to.md` | 補足教材「토」（旧タブ2）。`dist/to.html` になる |
| `src/style.css` | 見た目。自由に編集してよい（初期状態は Google ドキュメントの書き出しに合わせてある） |
| `src/images/` | 画像 |
| `font/` | フォント原本（ビルド時に必要な字だけ切り出して woff2 化される） |
| `dist/` | 生成物（git 管理外）。`fonts.css` と `fonts/*.woff2` も自動生成 |
| `.github/workflows/deploy.yml` | GitHub Pages への自動デプロイ |

## フォント

| | 日本語 | 朝鮮語 |
| --- | --- | --- |
| 本文 | Source Han Sans JP | 천리마 (KP CheonRiMa KCC) |
| 例文 (`:<: s` … `:>:`) | Source Han Serif JP (Regular / Bold) | 청봉 (KP CheongPong Bold) |

`npm run build` が `font/` の原本から**実際に使われている文字だけ**を切り出して
`dist/fonts/*.woff2`（全部で約 470KB）と `dist/fonts.css` を生成します。
朝鮮語フォントには `unicode-range` でハングルの範囲だけを割り当ててあるので、
同じ段落の中でも日本語は日本語フォント、ハングルは朝鮮語フォントで出ます。
切り出した結果は `.cache/fonts/` にキャッシュされ、本文を書き換えたときだけ作り直されます。
フォントの割り当てを変えるには `tools/build.mjs` の `FONTS` と `src/style.css` の `--sans` / `--serif` を触ってください。

## 原稿の書き方

- ページを増やすときは `src/` に `.md` を足すだけです（`src/foo.md` → `dist/foo.html`）。先頭の `---` … `---` に `title:` を書きます。ページ間のリンクは `<nav class="page-nav">` で。
- 太字は必ず `<b>…</b>` を使います（`**…**` は使いません）。
- 段落内の改行はそのまま `<br>` になります（Google ドキュメントの Shift+Enter と同じ感覚）。空行が段落の区切りです。
- 生 HTML が使えます。`<details class="note"><summary>補足</summary> … </details>` が折りたたみの補足欄です。
  開いた状態にしたければ `<details class="note" open>` とします。
  折りたたまずに囲みたいときは `<div class="note"> … </div>`。
  どちらも中身は空行で挟めば Markdown として書けます。
- 文字色は `<span class="blue">`, `<span class="gray">`。
- 下線は `<u>`。下線の位置は `src/style.css` の `--underline-position`（既定は `under`）で一括調整できます。
- 例文は `:<: s` と `:>:` で囲みます。`<div class="sample">` になり、Source Han Serif＋청봉が当たります。
  一般に `:<: なまえ` … `:>:` は `<div class="なまえ">` になります（`s` だけは `sample` に読み替え）。
- 表は `<table class="grid">`。列幅は `w-sm` / `w-md` / `w-lg`、左に寄せるなら `indent`、灰色のセルは `<td class="blocked">`。
