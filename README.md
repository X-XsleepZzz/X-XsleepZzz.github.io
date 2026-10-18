# 個人サイト

文章を中心にした、Astro・Markdown・CSSによる個人サイトです。GitHub Pagesで無料公開し、`main`へのpushで自動更新します。データベース、CMS、外部フォントAPI、アクセス解析は使いません。

- 公開先: https://x-xsleepzzz.github.io/
- リポジトリ: https://github.com/X-XsleepZzz/X-XsleepZzz.github.io
- 公開記事: `src/content/writing/`
- 記事テンプレート: `templates/article.md`
- デザイン調査: `docs/DESIGN.md`
- 検証記録: `docs/VERIFICATION.md`
- デザインの保存版・戻し方: `docs/DESIGN_HISTORY.md`

## 開発環境

Node.js 24 LTSを推奨します（Astroの最低要件は22.22.0）。Node.jsのバージョンを管理している場合は `.nvmrc` を利用できます。

```sh
nvm install
nvm use
npm ci
npm run dev
```

`nvm`を使わない場合は[公式のNode.js](https://nodejs.org/)から24 LTSを入れ、`npm ci`以降を実行します。表示されるローカルURL（通常 `http://127.0.0.1:4321/`）を開いてください。

```sh
npm run check    # Astro・TypeScriptの検証
npm test         # 日付とタイムゾーンの検証
npm run build   # dist/への本番ビルドと検証原稿混入チェック
npm run preview # 本番成果物のローカル確認
```

依存関係は `package-lock.json` で固定しています。通常の執筆では `npm update` は不要です。

## 記事を追加する

```sh
cp templates/article.md src/content/writing/my-first-note.md
```

コピーしたMarkdownを編集します。ファイル名がURLになります。上の例は `/writing/my-first-note/` です。長期的なリンクを保つため、公開後のファイル名変更は避けてください。

```yaml
---
title: "記事のタイトル"
description: "一覧と検索結果などに使う、短い説明"
publishedAt: "2026-10-18"
category: Notes
draft: true
language: ja
---
```

下の行から本文を書きます。本文の見出しは `##` から始めてください。ページのタイトルは `title` から自動生成されます。説明、カテゴリ、更新日、下書き指定、言語は任意です。言語を省略すると `ja`、下書き指定を省略すると `false` です。

公開するときは **`draft: false`** に変更してください。テンプレートは誤公開を避けるため `true` で始まります。`draft: true` の記事は、Home・Writingにも記事詳細ページにも生成されません。公開リポジトリにpushしたMarkdownの原稿そのものは、下書きであってもGitHub上で閲覧できます。非公開の原稿はpushしないでください。

表示順は公開日の降順です。更新日は並び順に影響しません。同じ公開日時の場合はファイル名順です。未来の日付でも `draft: false` なら公開されます。予約公開機能はありません。

## 記事を更新する

公開済みのMarkdownを直接編集し、必要に応じて `updatedAt` を追加します。**`publishedAt` は初めて公開した日付のままにします。**

```yaml
publishedAt: "2026-10-18"
updatedAt: "2026-10-20"
```

`updatedAt` は `publishedAt` より前にできません。メタデータに誤りがあればビルドが失敗し、不正な状態での自動公開を止めます。

## 日付と時刻

ISO 8601形式の**引用符付き文字列**で設定します。

| 入力 | 表示 |
| --- | --- |
| `"2026-10-18"`、`language: ja` | 2026年10月18日 |
| `"2026-10-18"`、`language: en` | Oct 18, 2026 |
| `"2026-10-18T09:30:00+09:00"` | 2026年10月18日 09:30 (UTC+09:00) |
| `"2026-10-18T00:30:00Z"` | 2026年10月18日 00:30 (UTC) |

日付のみの場合は時刻を表示せず、読者のタイムゾーンで前日に変換しません。並び順を比較するときだけ、日本のカレンダーの当日00:00を基準にします。

時刻を指定する場合は `Z` または `+09:00` などのUTCオフセットが必須です。表示には入力した日付・時刻・オフセットを用い、順序の比較には実際の瞬間を用います。秒・小数秒は順序の比較に使いますが、画面の時刻表示は分までです。

## カテゴリと言語

`category` は `Learning`、`Essays`、`Notes` から選びます。不要なら行ごと省略できます。カテゴリはメタデータとして保持し、画面のラベル・フィルター・カテゴリページは生成しません。

`language` は `ja` または `en` です。記事ページの言語、日付、案内リンク、本文の行間を切り替えます。Home・Writingは日本語を基調とし、各記事のタイトルと日付は記事自身の言語に従います。

## 画像

画像を `public/images/` に置き、Markdownに次のように書きます。

```md
![図の内容を伝える代替テキスト](/images/example.webp)
```

可能ならWebPやAVIFなどの適切なサイズの画像を使います。表示領域の確保と遅延読み込みを指定したい場合はHTMLも利用できます。

```html
<figure>
  <img src="/images/example.webp" width="1200" height="800"
       alt="図の内容を伝える代替テキスト" loading="lazy" />
  <figcaption>画像の説明・出典</figcaption>
</figure>
```

CSSが本文幅に収め、縦横比を保ちます。画像の権利と個人情報も確認してから追加してください。

## コード・表・リンク

コードフェンスに `typescript`、`python` などの言語を指定すると、ビルド時に色分けされます。ブラウザに構文解析用JavaScriptは配信しません。長いコードはブロック内だけで横スクロールできます。Tabでフォーカスして左右キーでも操作できます。

Markdownの箇条書き、引用、表、リンクに対応しています。長いURLは折り返し、表は必要な場合に表の領域で横スクロールします。

## テーマ

初回はOSのテーマに従います。ヘッダーのボタンをクリック、またはTabで選択してEnter・Spaceで切り替えられます。選択はブラウザの `localStorage` に保存されます。OS追従に戻す場合は、このサイトのストレージから `notes-theme` を削除してください。JavaScriptが無効でも本文は表示され、OSのテーマをCSSで適用します。

## GitHub Pagesへ公開する

初回設定は [Astro公式のGitHub Pages手順](https://docs.astro.build/en/guides/deploy/github/)に従っています。ユーザーサイト用リポジトリなので `base` は不要です。

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
2. `main` にpushします。
3. Actionsの「Deploy Notes to GitHub Pages」が完了するのを待ちます。
4. 公開URLを開き、表示を確認します。

通常の記事追加は、次の操作で公開できます。

```sh
npm run check
npm test
npm run build
git add src/content/writing public/images
git commit -m "Add a new note"
git push origin main
```

ワークフローは `withastro/action@v6` と `actions/deploy-pages@v5` を使い、型チェック・日付テスト・本番成果物チェックを通してから公開します。課金サービスや独自ドメインは必要ありません。

## 表示検証用の原稿

`tests/fixtures/` は著者の記事ではなく、表示検証専用です。

```sh
npx playwright install chromium
npm run build:qa
python3 -m http.server 4321 --bind 127.0.0.1 --directory .qa-dist
```

別ターミナルで実行します。

```sh
npm run test:browser
npm run audit
```

QAビルドは、専用環境変数と `--mode qa` の両方を指定した場合のみ検証原稿を読み込み、専用の `.qa-dist/` に出力します。画面には検証用の帯、HTMLには `noindex` を付けます。通常の `npm run build` とGitHub Actionsは常に公開記事だけを `dist/` に生成します。`.qa-dist/` をGitHub Pagesへアップロードしないでください。

スクリーンショットは `qa/screenshots/`、Lighthouseの詳細は `qa/lighthouse/` に保存します。これらの自動生成ファイルはGit管理しません。

## フォントとライセンス

- 英語本文: **Source Serif 4**、400・600・400 italic
- 日本語本文: **Shippori Mincho（しっぽり明朝）**、400
- 英語UI・見出し: **Inter**、400・500。日本語UI・見出しはOS標準のゴシック体
- コード: OS標準の等幅フォント

3種類のWebフォントはSIL Open Font License 1.1です。Fontsourceの固定バージョンから自己ホストし、日本語には `unicode-range` によるサブセットを利用します。ライセンス全文を `public/licenses/` に同梱しています。外部のGoogle Fontsサーバーへブラウザから接続しません。

ビルド時には、UIと記事に含まれる文字から必要な日本語サブセットのCSS定義だけを選びます。フォントファイル自体は改変しません。記事を追加してビルドすると自動で選び直すため、手動で文字やフォントを登録する必要はありません。

フォント、配色、余白は `src/layouts/Base.astro` と `src/styles/global.css` で管理します。日常の執筆で変更する必要はありません。
