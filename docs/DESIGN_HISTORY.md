# デザインの履歴と復元

## 初版（2026-10-18）

大きな「Notes」、英語の見出し、サブタイトルを置いた最初の版。

- Gitタグ: `design-2026-10-18-initial`
- コミット: `2257bddea6a909f4af49b5f57c94ed956955f077`
- [GitHub上の保存版](https://github.com/X-XsleepZzz/X-XsleepZzz.github.io/tree/design-2026-10-18-initial)
- ソースZIP: `backups/initial-2257bdd-source.zip`
- 公開用ファイル: `backups/initial-2257bdd-static.tar.gz`
- 公開時の画像: `backups/initial-screenshots/`

ZIP・公開用ファイル・画像はローカルに保存し、Git管理外としている。ソースはGitHubのタグからも取得できる。

## 余白を増やした版（2026-10-18）

サイト名・キャッチコピー・英語の飾り見出し・カテゴリラベル・装飾の矢印を除いた。ナビは「ホーム」「記事一覧」、ページ見出しは15–16px。本文以外の見出しをゴシック体に揃え、横幅680px、モバイルの左右余白32px、上部の余白104–160pxにした。記事本文の読みやすさ、Markdown管理、日付、テーマ切替は維持した。

- Gitタグ: `design-2026-10-18-spacious`
- コミット: `005a37b1824f3beab0f0982b5385c542187133ac`
- [GitHub上の保存版](https://github.com/X-XsleepZzz/X-XsleepZzz.github.io/tree/design-2026-10-18-spacious)
- ソースZIP: `backups/spacious-005a37b-source.zip`
- 公開用ファイル: `backups/spacious-005a37b-static.tar.gz`
- 画面画像: `backups/spacious-screenshots/`

## サイドバー版（2026-10-18）

[hikalium.com](https://hikalium.com/index)を参考に、左にナビ、右に本文を配置した。参照元の等幅文字と素朴なリンク、装飾の少ない構成を参考にしたもので、ロゴ・画像・文章・CSSは転載していない。参照元のナビ自体は横並びだが、この版では依頼に合わせてサイドバーへまとめた。

PC・タブレットではナビがスクロールに追従する。700px以下ではナビを上へ移し、本文幅を確保する。サイト名やキャッチコピーを復活させず、実際のドメインを小さく表示する。本文の読みやすさとMarkdown運用は維持した。

## 余白を増やした版へ戻す

編集中の変更をコミットしてから、次を実行する。この版とサイドバー版の表示上の差はレイアウトとCSSにまとまっている。

```sh
git fetch origin --tags
git restore --source design-2026-10-18-spacious -- \
  src/layouts/Base.astro \
  src/styles/global.css \
  tests/browser/site.spec.ts
npm run check
npm test
npm run build
git add src/layouts/Base.astro src/styles/global.css tests/browser/site.spec.ts
git commit -m "Restore the spacious design"
git push origin main
```

記事や画像を保存する `src/content/writing/` と `public/images/` は復元対象に含めない。

## 初版のデザインへ戻す

将来の記事ファイルを消さずに、見た目と対応する検証コードだけを戻す場合は、変更をコミットしてから次を実行する。

```sh
git fetch origin --tags
git restore --source design-2026-10-18-initial -- \
  src/layouts/Base.astro \
  src/pages/index.astro \
  src/pages/404.astro \
  src/pages/writing/index.astro \
  'src/pages/writing/[...id].astro' \
  src/components/WritingList.astro \
  src/styles/global.css \
  public/favicon.svg \
  tests/browser/site.spec.ts \
  scripts/verify-live.mjs
npm run check
npm test
npm run build
git add src public/favicon.svg tests/browser/site.spec.ts scripts/verify-live.mjs
git commit -m "Restore the initial design"
git push origin main
```

`src/content/writing/` と `public/images/` は復元対象に入れていないため、後から追加した記事や画像を保持できる。

ソース全体の過去の状態を別の場所で見る場合はGitHubの保存版からZIPを取得するか、ローカルのソースZIPを別フォルダに展開する。公開用ファイルのtar.gzを展開すれば、ビルドをせず初版の表示をローカルHTTPサーバーで確認できる。
