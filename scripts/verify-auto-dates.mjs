import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// All test articles and commits live in a disposable repository, never the live site.
const temporary = mkdtempSync(join(tmpdir(), 'astro-auto-dates-'));
const repository = join(temporary, 'repository');
mkdirSync(repository);
const run = (command, args, cwd = repository, extraEnv = {}) => execFileSync(command, args, {
  cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, CI: '1', ASTRO_TELEMETRY_DISABLED: '1', NOTES_QA: '0',
    GIT_AUTHOR_NAME: 'Date Test', GIT_AUTHOR_EMAIL: 'date@example.test',
    GIT_COMMITTER_NAME: 'Date Test', GIT_COMMITTER_EMAIL: 'date@example.test', ...extraEnv },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const commit = (date) => {
  run('git', ['add', '.']);
  run('git', ['commit', '-qm', 'date verification'], repository, { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
};
const build = (cwd = repository) => {
  run(process.execPath, [join(cwd, 'node_modules/astro/bin/astro.mjs'), 'build'], cwd);
  run(process.execPath, ['scripts/verify-production.mjs'], cwd);
};
const article = (draft, body = '本文を検証します。') => `---\ntitle: 自動日付の検証\ndraft: ${draft}\n---\n${body}\n`;
const times = (cwd = repository) => [...readFileSync(join(cwd, 'dist/writing/auto-dates/index.html'), 'utf8')
  .matchAll(/<time datetime="([^"]+)"/g)].map(match => match[1]);

try {
  for (const source of ['src', 'public', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json', '.gitignore']) {
    cpSync(source, join(repository, source), { recursive: true });
  }
  const dependencies = realpathSync('node_modules');
  symlinkSync(dependencies, join(repository, 'node_modules'));
  run('git', ['init', '-q']);
  const file = join(repository, 'src/content/writing/auto-dates.md');
  writeFileSync(file, article(true));
  commit('2026-01-01T12:00:00+09:00');
  writeFileSync(file, article(false));
  commit('2026-01-02T16:00:00Z');
  build();
  assert.deepEqual(times(), ['2026-01-03']);
  console.log('First publication: date auto-filled, update absent.');

  writeFileSync(file, article(false, '本文を加筆しました。'));
  commit('2026-01-04T16:00:00Z');
  build();
  assert.deepEqual(times(), ['2026-01-03', '2026-01-05']);
  console.log('Article edit: publication retained, update auto-filled.');

  writeFileSync(join(repository, 'unrelated.txt'), 'A design-only rebuild must preserve article dates.');
  commit('2026-02-01T12:00:00+09:00');
  build();
  assert.deepEqual(times(), ['2026-01-03', '2026-01-05']);
  const clone = join(temporary, 'clone');
  run('git', ['clone', '-q', repository, clone]);
  symlinkSync(dependencies, join(clone, 'node_modules'));
  build(clone);
  assert.deepEqual(times(clone), ['2026-01-03', '2026-01-05']);
  console.log('Unrelated rebuild and fresh clone: both dates unchanged.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
