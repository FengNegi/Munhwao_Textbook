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
| `custom-transliteration/` | ハングルのローマ字転写（ホバー表示に使う）。`node custom-transliteration/run-tests.js` でテスト |
| `.github/workflows/deploy.yml` | GitHub Pages への自動デプロイ |

## フォント

| | 日本語 | 朝鮮語 |
| --- | --- | --- |
| 本文 | Source Han Sans JP (Normal / Bold) | 천리마 (KP CheonRiMa KCC) |
| 例文 (`:<: s` … `:>:`) | Source Han Serif JP (Regular / Bold) | 청봉 (KP CheongPong Bold) |

太字は本物のボールド体を読み込んでいます（ブラウザが線を太らせる合成ボールドではありません）。
ただし**朝鮮語の本文だけは例外**で、천리마にボールドがないため `<b>` は合成ボールドになります。
ハングルの太字をはっきり見せたい箇所は、例文の囲み（청봉）を使うのが確実です。

`npm run build` が `font/` の原本から**実際に使われている文字だけ**を切り出して
`dist/fonts/*.woff2`（全部で約 800KB）と `dist/fonts.css` を生成します。
朝鮮語フォントには `unicode-range` でハングルの範囲だけを割り当ててあるので、
同じ段落の中でも日本語は日本語フォント、ハングルは朝鮮語フォントで出ます。
切り出した結果は `.cache/fonts/` にキャッシュされ、本文を書き換えたときだけ作り直されます。
フォントの割り当てを変えるには `tools/build.mjs` の `FONTS` と `src/style.css` の `--sans` / `--serif` を触ってください。

## ローマ字転写

ハングルの単語にマウスを乗せると、その語が薄青く光り、ローマ字転写が吹き出しで即座に出ます。
ビルド時に `tools/build.mjs` が本文中のハングルの語を
`<span class="translit" data-translit="…">` で包み、`src/style.css` の `.translit:hover::after`
が吹き出しを描いています（JS なし、遅延なし）。色や位置は `--translit-tint` /
`--tooltip-bg` / `--tooltip-ink` と `.translit` の規則で調整できます。
吹き出しの文字はページ自身が描くので、`ŏ` `ŭ` `⟨⟩` などもフォントのサブセットに自動で含まれます。

転写そのものは `custom-transliteration/transliterate.js` です。音韻規則は一切使わず、
字母に分解して置き換えて組み直すだけなので、않는다 は `anH.nŭn.ta`、꽃을 は `kkoch.ŭr` になります。
単独の字母は `⟨k⟩` のように山括弧に入ります。規則を変えたら
`node custom-transliteration/run-tests.js` でテストを回してください。

語の切れ目は「連続するハングル」で決めます。사이표 は語の内部として扱うので 기'발 は `ki'par`
でひとまとまりですが、途中にタグが入ると別の語になります
（例えば 사람<b>이</b> は `sa.ram` と `i` の 2 つに分かれます）。

## 原稿の書き方

- ページを増やすときは `src/` に `.md` を足すだけです（`src/foo.md` → `dist/foo.html`）。先頭の `---` … `---` に `title:` を書きます。ページ間のリンクは `<nav class="page-nav">` で。
- 太字は必ず `<b>…</b>` を使います（`**…**` は使いません）。
- 段落内の改行はそのまま `<br>` になります（Google ドキュメントの Shift+Enter と同じ感覚）。空行が段落の区切りです。
- 囲みは `:<: なまえ` で開いて `:>:` で閉じます。HTML タグは書かなくて構いません。

  | 書き方 | でき上がり |
  | --- | --- |
  | `:<: b 補足` … `:>:` | 折りたたみの補足欄（見出しは `b` の後ろに書いたもの） |
  | `:<: b-open 補足` … `:>:` | 同じものが最初から開いた状態 |
  | `:<: box` … `:>:` | 見出しなしの囲み（折りたたまない） |
  | `:<: s` … `:>:` | 例文（Source Han Serif＋청봉） |

  中身は空行で挟んでおけば普通に Markdown として書けます。入れ子にもできます。
  閉じ忘れ・知らない名前・見出しの書き忘れは、ビルドのときに行番号つきで教えてくれます。
  囲みの種類を増やすには `tools/build.mjs` の `BLOCKS` に足してください。
- 文字色は `<span class="blue">`, `<span class="gray">`。
- 下線は `<u>`。下線の位置は `src/style.css` の `--underline-position`（既定は `under`）で一括調整できます。
- 表は `<table class="grid">`。列幅は `w-sm` / `w-md` / `w-lg`、左に寄せるなら `indent`、灰色のセルは `<td class="blocked">`。
