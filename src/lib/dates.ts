export type ArticleLanguage = 'ja' | 'en';

const datePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/;

/** Keep date-only input as a calendar date; reject ambiguous local timestamps. */
export function isValidArticleDate(value: string): boolean {
  const match = datePattern.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offset] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) return false;
  if (hour === undefined) return true;
  if (+hour > 23 || +minute > 59 || +(second ?? 0) > 59) return false;
  if (offset !== 'Z' && (+offset.slice(1, 3) > 23 || +offset.slice(4, 6) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

export function articleTimestamp(value: string): number {
  if (!isValidArticleDate(value)) throw new Error(`Invalid article date: ${value}`);
  // A calendar-only publication belongs to its Japanese calendar day.
  return Date.parse(value.length === 10 ? `${value}T00:00:00+09:00` : value);
}

export function formatArticleDate(value: string, language: ArticleLanguage = 'ja'): string {
  if (!isValidArticleDate(value)) throw new Error(`Invalid article date: ${value}`);
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const date = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: language === 'ja' ? 'long' : 'short', day: 'numeric', timeZone: 'UTC',
  }).format(calendar);
  if (value.length === 10) return date;
  // Show the entered wall-clock time together with its explicit UTC offset.
  const time = value.slice(11, 16);
  const offset = value.endsWith('Z') ? 'UTC' : `UTC${value.slice(-6)}`;
  return `${date} ${time} (${offset})`;
}
