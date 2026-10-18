import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { datesFromRevisions, resolveArticleDates } from '../src/lib/article-history.ts';

const article = (draft = false, body = '本文', extra = '') => `---\ntitle: 日付の検証\ndraft: ${draft}\n${extra}---\n${body}\n`;

test('publication starts after drafting, updates keep publication and use Japanese calendar days', () => {
  const revisions = [
    { timestamp: '2026-01-01T10:00:00Z', source: article(true) },
    { timestamp: '2026-01-02T16:00:00Z', source: article() },
    { timestamp: '2026-01-04T16:00:00Z', source: article(false, '加筆') },
  ];
  assert.deepEqual(datesFromRevisions(revisions), {
    publishedAt: '2026-01-03', updatedAt: '2026-01-05', fingerprint: '{"title":"日付の検証"}\n加筆\n',
  });
  assert.equal(datesFromRevisions(revisions.slice(0, 1)), undefined);
  assert.equal(datesFromRevisions(revisions.slice(0, 2))?.updatedAt, undefined);
});

test('renaming, date metadata and temporary draft switches do not invent updates', () => {
  const revisions = [
    { timestamp: '2026-01-02T10:00:00Z', source: article() },
    { timestamp: '2026-01-03T10:00:00Z', source: article(false, '本文', 'publishedAt: "2026-01-02"\n') },
    { timestamp: '2026-01-04T10:00:00Z', source: article(true) },
    { timestamp: '2026-01-05T10:00:00Z', source: article() },
  ];
  assert.equal(datesFromRevisions(revisions)?.publishedAt, '2026-01-02');
  assert.equal(datesFromRevisions(revisions)?.updatedAt, undefined);
});

test('same-day edits show an update and clock skew cannot put update before publication', () => {
  const source = article();
  assert.equal(datesFromRevisions([
    { timestamp: '2026-01-03T01:00:00Z', source },
    { timestamp: '2026-01-03T02:00:00Z', source: article(false, '更新') },
  ])?.updatedAt, '2026-01-03');
  assert.equal(datesFromRevisions([
    { timestamp: '2026-01-03T01:00:00Z', source },
    { timestamp: '2026-01-01T02:00:00Z', source: article(false, '更新') },
  ])?.updatedAt, '2026-01-03');
});

test('real Git history survives renames, rebuilds and fresh clones; manual overrides and previews work', () => {
  const root = mkdtempSync(join(tmpdir(), 'article-history-'));
  const repository = join(root, 'repository');
  mkdirSync(repository);
  const git = (args: string[], date = '2026-01-01T12:00:00+09:00', cwd = repository) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 'Date Test', GIT_AUTHOR_EMAIL: 'date@example.test',
      GIT_COMMITTER_NAME: 'Date Test', GIT_COMMITTER_EMAIL: 'date@example.test',
      GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
  const commit = (date: string) => { git(['add', '.']); git(['commit', '-qm', 'article change'], date); };
  try {
    git(['init', '-q']);
    const original = join(repository, '日本語の記事.md');
    const renamed = join(repository, 'renamed article.md');
    writeFileSync(original, article(true)); commit('2026-01-01T12:00:00+09:00');
    writeFileSync(original, article()); commit('2026-01-03T00:10:00+09:00');
    assert.deepEqual(resolveArticleDates(original, {}), { publishedAt: '2026-01-03' });
    renameSync(original, renamed); commit('2026-01-04T12:00:00+09:00');
    assert.deepEqual(resolveArticleDates(renamed, {}), { publishedAt: '2026-01-03' });
    writeFileSync(renamed, article(false, '更新')); commit('2026-01-05T12:00:00+09:00');
    const expected = { publishedAt: '2026-01-03', updatedAt: '2026-01-05' };
    assert.deepEqual(resolveArticleDates(renamed, {}), expected);
    writeFileSync(join(repository, 'style.css'), 'body {}'); commit('2026-02-01T12:00:00+09:00');
    assert.deepEqual(resolveArticleDates(renamed, {}), expected);
    assert.deepEqual(resolveArticleDates(renamed, { publishedAt: '2025-12-01', updatedAt: '2026-01-08' }), {
      publishedAt: '2025-12-01', updatedAt: '2026-01-08',
    });
    const clone = join(root, 'clone');
    git(['clone', '-q', repository, clone]);
    assert.deepEqual(resolveArticleDates(join(clone, 'renamed article.md'), {}), expected);
    const shallow = join(root, 'shallow');
    git(['clone', '-q', '--depth=1', `file://${repository}`, shallow]);
    assert.throws(() => resolveArticleDates(join(shallow, 'renamed article.md'), {}), /全履歴/);
    writeFileSync(renamed, article(false, '編集中'));
    const previewTime = new Date('2026-02-05T16:00:00Z');
    utimesSync(renamed, previewTime, previewTime);
    assert.deepEqual(resolveArticleDates(renamed, {}, true), { publishedAt: '2026-01-03', updatedAt: '2026-02-06' });
    const unpublished = join(repository, 'new.md');
    writeFileSync(unpublished, article()); utimesSync(unpublished, previewTime, previewTime);
    assert.deepEqual(resolveArticleDates(unpublished, {}, true), { publishedAt: '2026-02-06' });
    assert.throws(() => resolveArticleDates(unpublished, {}), /コミット/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
