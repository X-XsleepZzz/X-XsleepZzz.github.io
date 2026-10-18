---
title: "Markdown とコードの表示を確かめる"
description: "コード、表、長いURL、明示したタイムゾーンの表示検証。"
publishedAt: "2026-10-17T09:30:00+09:00"
updatedAt: "2026-10-18T11:15:00+09:00"
category: Learning
language: ja
---

<!-- NOTES_QA_FIXTURE -->

これは技術記事の表示検証用原稿です。コードや表の見た目を確認するための文章であり、著者の記事として公開されません。

## 公開日を文字列で扱う

日付だけの値と、時刻を含む値には違いがあります。`2026-10-18` はカレンダー上の一日を表します。タイムゾーンを指定した `2026-10-18T09:30:00+09:00` は、ある瞬間を表します。

```typescript
type Article = {
  title: string;
  publishedAt: string;
  updatedAt?: string;
};

const article: Article = {
  title: '日付の表示を確かめる',
  publishedAt: '2026-10-18',
};

console.log(article.publishedAt);
```

### 長いコードはブロックの中でスクロール

次の一行は、スマートフォンでコードブロックだけが横にスクロールすることを確認するために、意図的に長くしています。キーボードでフォーカスして、左右キーでも読み進められます。

```javascript
const longConfiguration = { publishedAt: '2026-10-18T09:30:00+09:00', updatedAt: '2026-10-19T11:00:00+09:00', description: 'This deliberately long line verifies local scrolling inside a code block.' };
```

## 表とリンク

| 項目 | 入力例 | 意味 |
| --- | --- | --- |
| 公開日 | `2026-10-18` | 日付だけを表示 |
| 公開日時 | `2026-10-18T09:30:00+09:00` | 時刻と UTC+09:00 を表示 |
| 下書き | `draft: true` | 本番に生成しない |

長いURLは、ページの幅を超えずに折り返します。

[https://example.com/documentation/a-deliberately-long-path-to-verify-responsive-typography-and-line-breaking?language=ja&format=markdown](https://example.com/documentation/a-deliberately-long-path-to-verify-responsive-typography-and-line-breaking?language=ja&format=markdown)

---

本文のリンク、表、コードのどれも、背景が変わったときに読めるコントラストを保つ必要があります。
