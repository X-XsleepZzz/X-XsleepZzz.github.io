import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveArticleDates } from '../src/lib/article-history.ts';

for (const method of ['merge', 'squash'] as const) {
  test(`CMS ${method}: only main publication counts, updates and clones retain dates`, () => {
    const root = mkdtempSync(join(tmpdir(), `cms-${method}-`));
    const repository = join(root, 'repository');
    mkdirSync(repository);
    const git = (args: string[], date = '2026-01-01T12:00:00+09:00', cwd = repository) =>
      execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_AUTHOR_NAME: 'CMS Test', GIT_AUTHOR_EMAIL: 'cms@example.test',
          GIT_COMMITTER_NAME: 'CMS Test', GIT_COMMITTER_EMAIL: 'cms@example.test',
          GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
    const commit = (date: string) => { git(['add', '.']); git(['commit', '-qm', 'CMS save'], date); };
    const publish = (branch: string, date: string) => {
      git(['switch', 'main']);
      if (method === 'merge') git(['merge', '--no-ff', '-m', 'CMS publish', branch], date);
      else { git(['merge', '--squash', branch]); git(['commit', '-qm', 'CMS publish'], date); }
    };
    const source = (body: string, draft = false) => `---\ntitle: CMS 日本語\ncategory: Essays\nlanguage: ja\ndraft: ${draft}\n---\n\n${body}\n`;
    const file = join(repository, 'writing.md');
    try {
      git(['init', '-q', '-b', 'main']);
      writeFileSync(join(repository, 'README.md'), 'Base'); commit('2026-01-01T12:00:00+09:00');
      git(['switch', '-c', 'cms/new']);
      writeFileSync(file, source('最初の原稿')); commit('2026-01-02T12:00:00+09:00');
      writeFileSync(file, source('公開前の加筆')); commit('2026-01-03T12:00:00+09:00');
      git(['switch', 'main']);
      assert.equal(git(['ls-files', 'writing.md']).trim(), '', 'Saved PR is absent from main');
      publish('cms/new', '2026-01-04T16:10:00Z');
      assert.deepEqual(resolveArticleDates(file, {}), { publishedAt: '2026-01-05' });
      git(['switch', '-c', 'cms/update']);
      writeFileSync(file, source('公開後の加筆')); commit('2026-01-06T12:00:00+09:00');
      git(['switch', 'main']);
      assert.deepEqual(resolveArticleDates(file, {}), { publishedAt: '2026-01-05' });
      publish('cms/update', '2026-01-07T16:10:00Z');
      const expected = { publishedAt: '2026-01-05', updatedAt: '2026-01-08' };
      assert.deepEqual(resolveArticleDates(file, {}), expected);
      writeFileSync(join(repository, 'cms-config.yml'), 'backend: github'); commit('2026-02-01T12:00:00+09:00');
      assert.deepEqual(resolveArticleDates(file, {}), expected);
      const clone = join(root, 'clone'); git(['clone', '-q', repository, clone]);
      assert.deepEqual(resolveArticleDates(join(clone, 'writing.md'), {}), expected);
      git(['switch', '-c', 'cms/draft']);
      writeFileSync(join(repository, 'draft.md'), source('GitHubに置いた下書き', true));
      commit('2026-02-02T12:00:00+09:00');
      publish('cms/draft', '2026-02-03T12:00:00+09:00');
      const draftFile = join(repository, 'draft.md');
      assert.throws(() => resolveArticleDates(draftFile, {}), /コミット/,
        'A similar draft must not inherit the copy source publication date');
      git(['switch', '-c', 'cms/draft-publication']);
      writeFileSync(draftFile, source('GitHubに置いた下書き', false));
      commit('2026-02-04T12:00:00+09:00');
      publish('cms/draft-publication', '2026-02-05T12:00:00+09:00');
      assert.deepEqual(resolveArticleDates(draftFile, {}), { publishedAt: '2026-02-05' });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
