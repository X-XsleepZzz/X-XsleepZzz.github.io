# デザイン調査と設計判断

調査日: 2026-10-18（日本時間）。Chromeで参考サイトを開き、computed styleを読み、Playwrightでも1440px・375pxの画面と実測値を保存した。CSSやブランド資産はサイトへ転載していない。

## 参考サイトの実測

対象は [Thinking Machines Lab](https://thinkingmachines.ai/)、[記事一覧](https://thinkingmachines.ai/blog/)、[記事詳細](https://thinkingmachines.ai/blog/lora/)。記事内容を模倣するための調査ではなく、文字組みと構造の調査である。

| 要素 | 1440pxでの観測 | 375pxでの観測 |
| --- | --- | --- |
| 本文 | Iowan Old Style BT / Georgia、17px、400、行間27.2px（1.6）、本文660px | 17pxのまま、本文約323px、左右約26px |
| 記事見出し | セリフ体30px、600、行間42px。本文とのサイズ比約1.76 | 30pxを維持し、複数行へ自然に折り返す |
| 一覧見出し | GT America、25.6px、400、行間28.16px、字間−0.384px | 同じサイズ、1列 |
| ナビ | 上端約15px。ロゴ左、ナビ右。15px、字間−0.15px | ロゴ左、メニューボタン右 |
| 日付と一覧 | 日付の列と、セリフ体のタイトル・著者の列。薄い罫線 | タイトル・著者・日付を縦に配置 |
| 余白 | 一覧のmainは上端54px、見出し上端約86px。項目ごとに約100px | 項目の区切りと左右の余白を維持 |
| リンク | 暗い本文色。ナビは基本的に下線なし、記事リンクはホバーで下線 | タップしやすい縦方向の一覧 |
| 記事詳細 | タイトル、著者・日付、本文。長い技術記事には目次・図表・脚注 | 目次などを再配置し本文幅を優先 |

外側のmain幅はページや目次の展開で変わるため、本文段落そのものの幅を基準にした。本文の字間は `normal`。ホーム本文の段落下余白は28.8px、記事本文は23.2pxだった。

GT AmericaとIowanのファイル、ロゴ、ブランド要素、原文、CSSは流用しない。

## Notesに採用した原則

本文700px、一覧とヘッダー800pxを上限とする。長文を読む幅と、日付を含む一覧の幅を分ける。スマートフォンの左右余白は24px。HomeとWritingの2リンクだけなのでモバイルのメニュー開閉は不要と判断した。

背景は温かな紙、文字は墨色。背景画像・テクスチャ・影・グラデーション・カードを置かず、見出しの大きさと余白、細い罫線だけで構造をつくる。サイト名のピリオドは文字で表現する独自の組版であり、参考サイトのロゴを使わない。

日本語本文は18px、行間1.95、モバイル17px。英語はSource Serifの字面に合わせ20px、行間1.75、モバイル19pxを初期実装し、実表示で評価する。日本語明朝体は400のみ。日本語の強調はUI書体500へ切り替え、複数の日本語フォントウェイトを取得しない。

見出しの上余白を下より大きくし、話題の区切りと本文とのつながりを示す。本文リンクは常時下線付き。情報の種類を区別するため、日付やカテゴリはサンセリフ体にする。記事一覧はリンクのタイトルを中心とした縦の列で、検索・複雑なフィルターは設けない。

記事がない状態も正式な画面とする。著者の経歴・体験・考えを創作せず、短い中立的な案内文だけを表示する。テスト原稿を本番に混ぜない。

## 最終パレット

| 役割 | Light | Dark |
| --- | --- | --- |
| 背景 | `#F8F3EA` | `#161412` |
| 本文 | `#2B2926` | `#EEE8E0` |
| 補助文字 | `#70675E` | `#B6ADA3` |
| 罫線 | `#DDD3C6` | `#3A342F` |
| リンク | `#2F2B27` | `#F0E3D0` |
| 下線 | `#BCA892` | `#8D775F` |
| コード背景・ホバー | `#F0E9DD` | `#211D19` |

罫線や下線の色だけで意味を伝えず、リンクの下線・配置・フォーカス表示と組み合わせる。コードはShikiのLight High Contrast / Dark配色を用いる。

## フォントの確認

FontsourceパッケージのmetadataとLICENSE、公式配布元を照合した。3書体ともOFL-1.1。改名が必要なフォント改変はせず、配布済みのサブセットを利用する。

- [Source Serif公式ライセンス](https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md)
- [Shippori MinchoのGoogle Fontsライセンス](https://github.com/google/fonts/blob/main/ofl/shipporimincho/OFL.txt)
- [Inter公式ライセンス](https://github.com/rsms/inter/blob/master/LICENSE.txt)

Source Serif 4のLatin 400・600・400 italic、InterのLatin 400・500、Shippori Minchoの400のみをCSSへ取り込む。日本語はunicode-rangeで必要な範囲だけダウンロードされる。コードに追加Webフォントは読み込まない。

画面・性能レビュー後、日本語の未使用サブセット定義もビルド時に省くようにした。公開記事とUIから文字を集めて自動選択し、フォントファイルは改変しない。開発サーバーではすべての定義を使うため、編集中に新しい文字を追加してもフォント設定の手作業は不要。

## 実装で参照した一次資料

- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/): glob loader、スキーマ、render、静的ルート
- [Astro GitHub Pages](https://docs.astro.build/en/guides/deploy/github/): 公式Action、site、ユーザーサイトではbase不要
- [Astro Syntax Highlighting](https://docs.astro.build/en/guides/syntax-highlighting/)
- [Shiki Transformers](https://shiki.style/guide/transformers): コードブロックへのキーボードフォーカス

画面レビューと改善内容は `docs/VERIFICATION.md` に記録する。
