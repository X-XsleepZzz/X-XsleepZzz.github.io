# CMSの設計・検証記録

対象: Sveltia CMS 0.248.0、Astro 7.4.0。調査日: 2026-10-19（日本時間）。
本番公開と既存記事の編集はこの作業の対象外。独立したPRで確認してから導入する。

## 実装前に決めた検証方針

| 対象 | 既存実装との接続 | 確認方法 |
| --- | --- | --- |
| Gitの日付 | `article-history.ts`のfirst-parent履歴、全履歴checkoutを維持 | 一時GitでPR相当の保存→通常マージ/squash→加筆→別cloneを再現。コピー・名前変更・下書きも検証 |
| Markdown | `src/content/writing/*.md`、既存Zodスキーマを維持 | CMSの実際の保存結果でコード・未知のFrontmatter・手動日付・省略可能フィールド・既存記事のコピーを照合 |
| Preview Workflow | 保存は記事別PR、明示的な公開でmainへマージ | 固定版の公式実装と設定を確認。Git再現とブラウザ試験を区別して記録。PR用Astroプレビューは構築しない |
| GitHub認証 | リポジトリ限定Fine-grained PAT。独自認証サーバーなし | 未認証UI・拒否応答をブラウザ確認。実PATの権限・PRの作成/マージはユーザー設定後に別途確認 |
| 下書き | ブラウザ内、公開GitHubのブランチ/PR、Pagesを区別 | ブラウザ内バックアップと公開ビルドのdraft除外を確認。公開GitHubを秘密の保存先としない |

## 互換性評価と判断

- 管理画面を`public/admin/`の静的HTMLとして分離する。Astroのルート・レイアウト・CSS・既存記事・スキーマ・デプロイ方式は維持する。
- `output.omit_empty_optional_fields: true`で未選択categoryの空文字/nullによるスキーマ違反を避ける。日時の入力欄は追加せず、既存の手動指定は保存時の保持をテストする。
- 実ブラウザ試験で、CMS標準のYAML出力が手動日付の引用符を外し、Astro側でDateとして解釈される非互換を確認。`output.yaml.quote: double`で文字列として保持する。Astroスキーマの緩和はしない。
- slugはSveltia標準の`editable: [create]`を使う。初回に手入力し、既存エントリーのリネームを禁止。Frontmatterにslugを追加しない。
- `draft: false`とPreview Workflowの未公開状態は別物。新規原稿はPR内ではfalseだが、mainへマージするまでサイトには出ない。従来の`draft: true`は編集できるように残す。
- GitHubは通常/squashマージをどちらも許可している。CMSには`squash_merges: true`を指定。既存`--first-parent`はPR内の保存日を公開日に使わない。
- 追加試験で、`git log --follow --diff-filter=AMR`が似た新規ファイルをコピーと判断し、その作成記録を除外してコピー元の記事の公開日を引き継ぐ問題を再現した。C（コピー）の記録も読み、A/Cを記事の起点として遡るのを止める最小修正を加える。R（名前変更）は従来どおり追跡する。
- `publish_mode: preview`はPR環境を必須としない。今回はCMS内プレビューのみ。サイトと同一のフォント・Shiki・日付表示を再現する独自プレビューは作らない。
- CMSが扱う画像は`public/images/`に保存。2 MiB制限、標準のUUID付き命名で同名上書きを避ける。EXIFの自動削除は追加せず運用手順で注意する。
- Preview Workflowは記事の保存に適用される。Asset Libraryの単独アップロード/置換/削除と公開済み記事の削除はmainへ直接反映される標準動作がある。通常の「保存」と混同しないよう操作手順に明記し、独自の画像投稿APIは作らない。

## 依存関係・セキュリティ

- 公式リリース`v0.248.0`（2026-10-17 UTC公開）とそのタグの実装を確認。CDNの正確なバージョンとSHA-384 SRIを固定。一般公開ページへは読み込まない。
- 公式の公開セキュリティ勧告9件を確認。最高の修正版は0.238.1で、採用版0.248.0は各勧告の影響バージョン範囲外。これは未知の脆弱性がないことの保証ではない。
- 既存lockfileの`npm audit --json --ignore-scripts`は既知の脆弱性0件。CDN配布物の全推移依存をこのnpm監査が監査したことにはならない。
- adminだけにCSPを設定。`script-src`には`unsafe-inline`/`unsafe-eval`を許可しない。スタイルにはCMS標準のインラインスタイルを許可。GitHub・CMS CDN・フォントCDNだけを必要に応じて許可する。
- `sanitize_preview: true`。`noindex`はアクセス制御ではない。PATはCMS標準どおりブラウザのLocal Storageに保存される。共有端末を避け、失効・再発行方法を文書化する。
- 公開サイトは元から著者のHTMLを許可する。CMSプレビューのサニタイズが公開HTMLのサニタイズまで保証するわけではない。信頼しないHTML/スクリプトを記事に入れない。

## 実行結果

2026-10-19にNode 24.19.0で実行した。ローカルでは`ASTRO_TELEMETRY_DISABLED=1`を設定した。

| コマンド/検証 | 結果 |
| --- | --- |
| `npm run check` | 32ファイル、0 errors / warnings / hints |
| `npm test` | 14件成功。既存9件を保持し、CMS設定3件・通常/squashマージ2件を追加 |
| `npm run test:dates:integration` | 成功。一時Git→Astroで初回公開・更新・無関係な変更・別cloneを確認 |
| `npm run build` | 成功。4ページとadminの静的ファイルを生成。既存の本番混入検査も成功 |
| `npm run build:qa` | 成功。表示検証用記事だけの6ページを別ディレクトリに生成 |
| `npm run test:browser` | 既存41件すべて成功。1440/768/375pxの明暗両テーマ、320px、日英記事、404相当の下書き除外、JS無効、キーボード、テーマ保存、axe違反0件 |
| `npm run test:cms` | 9件成功。固定版の実CMSで保存・編集・削除・手入力slug・未知メタデータと日付・Markdown・画像・XSS除去・認証拒否・保存失敗と再試行・バックアップ復元 |
| `npm run test:cms:content` | 成功。CMSが実際に出力した2記事と画像を一時Gitへ保存し、Astroビルドと1440/390pxのブラウザ表示を検証。ja/en、4言語コード、表、画像、手動/自動日付、draft除外を確認 |
| `npm audit --json --ignore-scripts` | 既存lockfileの既知脆弱性0件。CMS本体は別途公式勧告を確認 |
| 公開用成果物のSHA-256照合 | adminを除く既存55ファイルが導入前後で完全一致。通常ページへの追加JS/CSS・画像・PDF・日付の変更なし |

CMSの試験では、GitHub APIの拒否応答401/403をブラウザでモックした。それ以外の編集・保存・削除・画像は公式Test Backendのブラウザ内ファイルシステムで試験した。自動バックアップはTest Backendではなく、**公式Local Workflowにブラウザ内の仮想フォルダを選択させて**復元まで確認した。実チェックアウトの既存記事は編集していない。

保存失敗試験は仮想フォルダの書き込み失敗を注入して行った。エラー表示、元ファイルの保持、エディター内の文章保持、再試行成功を確認した。これは実際のGitHub APIで保存中の切断・トークン失効・競合を再現した試験ではない。

初期試験で見つかった手動日付の引用符消失を設定で修正した。Playwrightの既存試験とCMS試験が同じ出力先を使いトレース保存に失敗したため、CMSの記録先を`qa/cms-test-results/`へ分離し、全9件を再実行して成功した。

ブラウザ確認時のURL:

- `http://127.0.0.1:4330/admin/`: 実CMS。Test Backendへの設定切替は試験用ブラウザの通信差替えだけで行い、本番config.ymlへ入れていない。
- `http://127.0.0.1:4331/writing/cms-roundtrip/`、`/writing/cms-metadata/`: 一時GitからのAstro表示。終了時に一時記事・サーバーを削除。
- `http://127.0.0.1:4327/`: QA専用表示。`NOTES_TEST_URL=http://127.0.0.1:4327 npm run test:browser`で実行。

ローカルの証跡（Git管理外）:

- `qa/screenshots/cms/editor-1440.png`、`editor-390.png`: CMSのバックアップ復元後の画面。目視確認済み。
- `qa/screenshots/cms/astro-1440.png`、`astro-390.png`: CMS出力の実Astro表示。390pxの見出し・表・コード・折り返しを目視確認済み。
- `qa/screenshots/cms-regression/`: 既存サイトの30画面。
- `qa/browser-results.json`: 既存41件の結果。
- `qa/cms-test-results/generated/`: 実CMSが保存したテスト用Markdown2件とPNG。公開用コンテンツには入れない。

再現順序（Node 24推奨）:

```sh
npm run check
npm test
npm run test:dates:integration
npm run build
npm run test:cms
npm run test:cms:content
npm run build:qa
python3 -m http.server 4327 --bind 127.0.0.1 --directory .qa-dist
# 別ターミナルで実行
NOTES_TEST_URL=http://127.0.0.1:4327 npm run test:browser
```

ブラウザテストにはPlaywright Chromiumとインターネット接続（固定版CMS CDN）が必要。自動テストは本番GitHubの投稿・公開を行わない。`test:cms:content`は先に`test:cms`で生成した入力を使う。

## 性能の確認

Lighthouse 13.5.0・新しいChromiumプロファイルで測定した。初回のQA再計測はHome 83、一覧92、日本語記事93、英語記事92、技術記事87で、以前の記録より低かった。初期の計測はCMS試験と実行が重なっており、以前の測定と同じ実行条件ではない。この値を隠したり、CMSの変更による劣化/改善と断定したりしない。生データは`qa/lighthouse/`、集計は`qa/lighthouse-summary.json`にある。

比較のため、導入前に記録したSHA-256と一致する公開用55ファイルを一時領域へコピーし、adminを含まない版とadminを追加した版を、別のローカルHTTPサーバー・新しいブラウザプロファイルで順番に計測した。サーバーは4333/4334ポートを使用し、他のブラウザ試験の終了後に実行した。

| 公開用Home | CMS追加前の一致確認済み成果物 | CMS追加後 |
| --- | ---: | ---: |
| Performance | 100 | 100 |
| Accessibility / Best Practices | 100 / 100 | 100 / 100 |
| LCP | 1.202秒 | 1.201秒 |
| Total Blocking Time | 0 ms | 0 ms |
| 転送量 | 56,226 bytes | 56,226 bytes |

比較データは`qa/cms-test-results/performance.json`、生データは同ディレクトリの`lighthouse-before.json`/`lighthouse-after.json`。この単独比較はHomeを対象としたローカル測定であり、本番回線や全ページの将来の点数を保証しない。全読者向けファイル55件の一致と併せて、CMS導入による読者ページの追加依存・転送量増加がないことを確認した。

## 本番導入前に残る確認

| 条件 | 現在の確認範囲 |
| --- | --- |
| AC-01 管理画面 | ローカルで確認。本番/admin/は未公開 |
| AC-02 GitHub認証 | 拒否応答と未認証時の書き込み不可を確認。本人の限定PATでの成功経路は未確認 |
| AC-03/04 作成・編集 | 実CMSと仮想リポジトリで確認。既存記事はコピーを使用 |
| AC-05 プレビュー | 見出し・強調・箇条書き・引用・表・コード・画像・リンク、スクリプト除去を確認。Astroとの見た目は同一ではない |
| AC-06 画像 | PNG/JPEG/WebP・同名追加・2 MiB超過拒否を仮想リポジトリで確認。EXIF除去は利用者が実施 |
| AC-07 GitHubへの公開 | 設定・固定版実装・Gitの通常/squash相当動作まで。実PR作成/マージ→Actionsは未確認 |
| AC-08 公開URL | 一時AstroビルドのURLで確認。本番公開操作は未実施 |
| AC-09 日付 | 既存テスト、一時Gitのマージ2方式、コピー/名前変更/下書き、Astro結合で確認 |
| AC-10 下書き | draft除外とブラウザ内未送信データを確認。GitHub上のPRを非公開ストレージとは扱わない |
| AC-11 認証情報 | ソース・設定・ビルドの検査を実施。本物のPATをこの作業で入力・保存していない |
| AC-12/13 回帰 | 上記の全コマンドと既存41件、既存成果物55ファイルの一致を確認 |
| AC-14 手動運用・撤去 | Markdownと既存CI/CDを維持。操作・失敗時の復旧・撤去手順をCMS_OPERATION.mdへ記載 |

本人のFine-grained PATを設定した安全なテスト用リポジトリで、保存→Draft PR→公開→マージ→Actionsの成功経路と、権限不足・保存中の切断・期限切れ・他端末編集の競合を確認する作業が残る。GitHubの実際の権限・保護ルール・配信成功をローカル試験だけで確認済みとはしていない。本番導入と既存記事の変更はユーザー確認後に行う。

## 変更ファイル

| ファイル | 変更の目的 |
| --- | --- |
| `public/admin/index.html` | 固定版CMS、SRI、noindex、admin限定CSP |
| `public/admin/config.yml` | GitHub/Preview Workflow、既存スキーマ・slug・Markdown・画像・YAML出力設定 |
| `src/lib/article-history.ts` | コピー元の日付継承の最小修正 |
| `tests/cms-history.test.ts` | main反映日・2方式のマージ・コピーの回帰試験 |
| `tests/cms-config.test.mjs` | 誤配信・スキーマ不整合・未固定依存の設定回帰試験 |
| `tests/cms/admin.spec.mjs` | 実CMSの9件のブラウザ試験 |
| `playwright.cms.config.ts` | CMS専用のサーバー・ブラウザ試験設定 |
| `scripts/verify-cms-content.mjs` | 実CMS出力→一時Git→Astro→ブラウザの結合試験 |
| `package.json` | 既存試験にCMSの設定/履歴試験を追加し、専用検証コマンドを追加 |
| `.gitignore` | CMS試験の生成物を除外 |
| `README.md` | CMS概要と操作/検証文書へのリンク |
| `docs/CMS_OPERATION.md` | 認証・執筆・保存/公開・画像・失敗時対応・撤去手順 |
| `docs/CMS_VERIFICATION.md` | 調査・検証方針・結果・未確認事項 |

既存記事、既存のテスト内容、Astroスキーマ、デプロイワークフロー、サイトのレイアウト/CSSは変更していない。

## 公式資料

- [Getting Started](https://sveltiacms.app/en/docs/start)
- [Astro Integration](https://sveltiacms.app/en/docs/frameworks/astro)
- [GitHub Backend](https://sveltiacms.app/en/docs/backends/github)
- [Preview Workflow](https://sveltiacms.app/en/docs/workflows/preview)
- [Slugs](https://sveltiacms.app/en/docs/collections/entries/slugs)
- [Data Output](https://sveltiacms.app/en/docs/data-output)
- [Media Storage](https://sveltiacms.app/en/docs/media)
- [Security](https://sveltiacms.app/en/docs/security)
- [Test Backend](https://sveltiacms.app/en/docs/backends/test)
- [Local Workflow](https://sveltiacms.app/en/docs/workflows/local)
- [固定リリース](https://github.com/sveltia/sveltia-cms/releases/tag/v0.248.0)
- [公開セキュリティ勧告](https://github.com/sveltia/sveltia-cms/security/advisories)
