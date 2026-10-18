import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.NOTES_LIVE_URL ?? 'http://127.0.0.1:4322';
const label = process.env.NOTES_LIVE_URL ? 'published' : 'production';
await mkdir(`qa/screenshots/${label}`, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 768, 375]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [name, route] of [['home', '/'], ['writing', '/writing/']]) {
      const response = await page.goto(new URL(route, base).href);
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      const body = await page.locator('body').innerText();
      assert.match(body, /記事は準備中です/);
      assert.doesNotMatch(body, /NOTES_QA_FIXTURE|AUTHORING_|DRAFT_|文章を読むための余白|A little room to think/);
      assert.equal(await page.locator('.qa-notice').count(), 0);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(axe.violations.map(v => v.id), []);
      for (const href of await page.locator('a[href^="/"]').evaluateAll(elements => [...new Set(elements.map(el => el.getAttribute('href')))])) {
        assert.equal((await context.request.get(new URL(href, base).href)).status(), 200);
      }
      const screenshot = `qa/screenshots/${label}/${name}-${width}-${theme}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({ page: name, width, theme, status: response.status(), axeViolations: 0, screenshot });
    }
    await page.getByRole('button', { name: 'ダークモード', exact: true }).click();
    const chosen = theme === 'light' ? 'dark' : 'light';
    assert.equal(await page.locator('html').getAttribute('data-theme'), chosen);
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), chosen);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const page = await browser.newPage();
  const missing = await page.goto(new URL(process.env.NOTES_LIVE_URL ? '/not-a-real-page/' : '/404.html', base).href);
  if (process.env.NOTES_LIVE_URL) assert.equal(missing.status(), 404);
  assert.match(await page.locator('h1').innerText(), /ページが見つかりません/);
  for (const specimen of ['/writing/ja-typography/', '/writing/en-typography/', '/writing/technical/', '/qa-specimen.svg']) {
    assert.equal((await page.request.get(new URL(specimen, base).href)).status(), 404);
  }
  await page.close();
} finally { await browser.close(); }
await writeFile(`qa/${label}-results.json`, JSON.stringify({ date: new Date().toISOString(), base, results }, null, 2));
console.log(`${label}: 12 screens passed (3 widths × 2 themes × 2 pages); empty state, links, theme persistence, zero axe violations, and 404 verified.`);
