import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

// Inputs are produced by the real pinned CMS in test:cms. Never add them to live content.
for (const file of ['cms-roundtrip.md', 'cms-metadata.md', 'cms-image.png']) {
  assert.ok(existsSync(`qa/cms-test-results/generated/${file}`), `先に npm run test:cms を成功させてください: ${file}`);
}
const root = mkdtempSync(join(tmpdir(), 'cms-astro-'));
const repository = join(root, 'repository');
mkdirSync(repository);
const run = (command, args) => execFileSync(command, args, {
  cwd: repository, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CI: '1', ASTRO_TELEMETRY_DISABLED: '1', NOTES_QA: '0',
    GIT_AUTHOR_NAME: 'CMS Test', GIT_AUTHOR_EMAIL: 'cms@example.test',
    GIT_COMMITTER_NAME: 'CMS Test', GIT_COMMITTER_EMAIL: 'cms@example.test',
    GIT_AUTHOR_DATE: '2026-02-03T16:10:00Z', GIT_COMMITTER_DATE: '2026-02-03T16:10:00Z' },
});
let server;
let browser;
try {
  for (const source of ['src', 'public', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'package.json', '.gitignore']) {
    cpSync(source, join(repository, source), { recursive: true });
  }
  symlinkSync(realpathSync('node_modules'), join(repository, 'node_modules'));
  const writing = join(repository, 'src/content/writing');
  cpSync('qa/cms-test-results/generated/cms-roundtrip.md', join(writing, 'cms-roundtrip.md'));
  cpSync('qa/cms-test-results/generated/cms-metadata.md', join(writing, 'cms-metadata.md'));
  const draft = readFileSync('qa/cms-test-results/generated/cms-roundtrip.md', 'utf8')
    .replace('draft: false', 'draft: true').replace('日本語の新規記事', 'CMS_UNPUBLISHED_SENTINEL');
  writeFileSync(join(writing, 'cms-unpublished.md'), draft);
  mkdirSync(join(repository, 'public/images'), { recursive: true });
  cpSync('qa/cms-test-results/generated/cms-image.png', join(repository, 'public/images/sample.png'));
  run('git', ['init', '-q', '-b', 'main']);
  run('git', ['add', '.']); run('git', ['commit', '-qm', 'CMS-generated content test']);
  run(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build']);
  run(process.execPath, ['scripts/verify-production.mjs']);
  assert.equal(existsSync(join(repository, 'dist/writing/cms-unpublished/index.html')), false);
  for (const route of ['index.html', 'writing/index.html']) {
    assert.doesNotMatch(readFileSync(join(repository, 'dist', route), 'utf8'), /CMS_UNPUBLISHED_SENTINEL/);
  }
  server = spawn('python3', ['-m', 'http.server', '4331', '--bind', '127.0.0.1', '--directory', join(repository, 'dist')], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch('http://127.0.0.1:4331/')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  mkdirSync('qa/screenshots/cms', { recursive: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    assert.equal((await page.goto('http://127.0.0.1:4331/writing/cms-roundtrip/')).status(), 200);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(), '日本語の新規記事');
    assert.equal(await page.locator('.prose table').count(), 1);
    assert.equal(await page.locator('.prose pre').count(), 4);
    assert.match(await page.locator('.prose pre').first().innerText(), /title: Frontmatterではない/);
    await page.locator('.prose img').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.prose img').evaluate(async image => { await image.decode(); return image.naturalWidth; }), 2);
    assert.equal(await page.locator('.article-meta time').first().getAttribute('datetime'), '2026-02-04');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `qa/screenshots/cms/astro-${width}.png`, fullPage: true });
    await page.goto('http://127.0.0.1:4331/writing/cms-metadata/');
    assert.deepEqual(await page.locator('.article-meta time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))),
      ['2026-01-01', '2026-01-02T09:30:00+09:00']);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('CMS output → temporary Git → Astro → browser passed: raw code, image, table, ja/en, automatic/manual dates, draft exclusion, 1440/390px.');
} finally {
  await browser?.close(); server?.kill(); rmSync(root, { recursive: true, force: true });
}
