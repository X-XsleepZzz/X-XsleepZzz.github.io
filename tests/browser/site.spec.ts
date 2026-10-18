import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

const pages = [
  ['home', '/'], ['writing', '/writing/'], ['article-ja', '/writing/ja-typography/'],
  ['article-en', '/writing/en-typography/'], ['article-code', '/writing/technical/'],
] as const;

for (const width of [1440, 768, 375]) {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, path] of pages) {
      test(`${name} · ${width}px · ${theme}: layout, links, accessibility`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await page.evaluate(() => document.fonts.ready);
        for (const img of await page.locator('.prose img').all()) {
          await img.scrollIntoViewIfNeeded();
          await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page.locator('h1')).toBeVisible();
        expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('body').innerText()).not.toContain('DRAFT_MUST_NEVER_APPEAR');
        for (const href of await page.locator('a[href^="/"]').evaluateAll(elements => [...new Set(elements.map(el => el.getAttribute('href')!))])) {
          expect((await context.request.get(href)).status(), href).toBe(200);
        }
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        expect(errors).toEqual([]);
        await mkdir(`qa/screenshots/${process.env.NOTES_REVIEW ?? 'final'}`, { recursive: true });
        await page.screenshot({ path: `qa/screenshots/${process.env.NOTES_REVIEW ?? 'final'}/${name}-${width}-${theme}.png`, fullPage: true });
        await context.close();
      });
    }
  }
}

test('newest first, localized dates, draft exclusion and navigation', async ({ page }) => {
  await page.goto('/writing/');
  await expect(page.locator('.entry-content h3')).toHaveText([
    '文章を読むための余白↗', 'Markdown とコードの表示を確かめる↗', 'A little room to think↗',
  ]);
  await expect(page.locator('.entry-date time')).toHaveText(['2026年10月18日', '2026年10月17日 09:30 (UTC+09:00)', 'Oct 16, 2026']);
  await page.getByRole('link', { name: '文章を読むための余白' }).click();
  await expect(page).toHaveURL(/\/writing\/ja-typography\/$/);
  await expect(page.locator('.article-meta')).toContainText('公開 2026年10月18日');
  await expect(page.locator('.article-meta')).toContainText('更新 2026年10月19日');
  expect(await page.locator('.article-meta').innerText()).not.toMatch(/00:00/);
  expect((await page.request.get('/writing/private-draft/')).status()).toBe(404);
});

test('theme toggles with keyboard, persists, and keeps manual preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'ダークモード', exact: true });
  await toggle.focus();
  await toggle.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('notes-theme'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Writing', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await toggle.focus();
  await toggle.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme changes propagate to another open tab', async ({ context, page }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/writing/');
  await page.getByRole('button', { name: 'ダークモード', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => localStorage.removeItem('notes-theme'));
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
});

test('320px: navigation and long technical content fit within the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/writing/technical/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'ダークモード', exact: true })).toBeVisible();
});

test('OS theme follows changes until a manual preference is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('keyboard skip link, focus visibility and code block scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/writing/technical/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '本文へスキップ' })).toBeFocused();
  expect(await page.locator(':focus-visible').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const pre = page.locator('pre').last();
  expect(await pre.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await pre.focus();
  await expect(pre).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => pre.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});

test('no JavaScript still renders content and follows dark OS preference', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/writing/en-typography/');
  await expect(page.locator('h1')).toHaveText('A little room to think');
  await expect(page.locator('.theme-toggle')).toBeHidden();
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(22, 20, 18)');
  await context.close();
});

test('localStorage unavailable does not break theme or content', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'ダークモード', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
