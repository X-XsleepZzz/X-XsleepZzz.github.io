import test from 'node:test';
import assert from 'node:assert/strict';
import { articleTimestamp, formatArticleDate, isValidArticleDate } from '../src/lib/dates.ts';

test('calendar dates stay unchanged in Japanese and English without fabricated times', () => {
  for (const timezone of ['Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Honolulu', 'UTC']) {
    process.env.TZ = timezone;
    assert.equal(formatArticleDate('2026-10-18', 'ja'), '2026年10月18日');
    assert.equal(formatArticleDate('2026-10-18', 'en'), 'Oct 18, 2026');
  }
});
test('timestamps retain the explicitly entered date, time and offset', () => {
  assert.equal(formatArticleDate('2026-10-18T00:15:00+09:00'), '2026年10月18日 00:15 (UTC+09:00)');
  assert.equal(formatArticleDate('2026-10-18T23:30:00-07:00', 'en'), 'Oct 18, 2026 23:30 (UTC-07:00)');
  assert.equal(formatArticleDate('2026-10-18T00:15:00Z', 'en'), 'Oct 18, 2026 00:15 (UTC)');
});
test('calendar validity and explicit timezone are required', () => {
  for (const date of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-01', '2026-01-00', '2026-10-18T24:00:00Z', '2026-10-18T12:00:60Z', '2026-10-18T12:00:00', '2026-10-18T12:00:00+25:00', '2026-10-18T12:00:00+09:70', 'not-a-date']) {
    assert.equal(isValidArticleDate(date), false, date);
  }
  for (const date of ['2024-02-29', '2026-10-18', '2026-10-18T00:00Z', '2026-10-18T00:00:00.123+09:00']) assert.ok(isValidArticleDate(date), date);
});
test('sorting uses instants; date-only publication is midnight on the Japanese calendar', () => {
  assert.equal(articleTimestamp('2026-10-18'), Date.parse('2026-10-18T00:00:00+09:00'));
  assert.equal(articleTimestamp('2026-10-18T00:00:00+09:00'), articleTimestamp('2026-10-17T15:00:00Z'));
  assert.ok(articleTimestamp('2026-10-18') > articleTimestamp('2026-10-17T09:30:00+09:00'));
});
