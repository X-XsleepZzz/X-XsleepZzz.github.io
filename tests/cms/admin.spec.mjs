import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseFrontmatter } from 'astro/markdown';

const config = parseFrontmatter(`---\n${await readFile('public/admin/config.yml', 'utf8')}\n---`).frontmatter;
const existing = await readFile('src/content/writing/ai-backend-practicum.md', 'utf8');
const body = [
  '## 日本語と English ☃', '', '**太字**と*斜体*、`inline`。', '',
  '- 項目1', '- 項目2', '', '> 引用', '',
  '| 名前 | 値 |', '| --- | --- |', '| 雪 | 1 |', '',
  '[リンク](https://example.com/)', '![画像](/images/sample.png)', '',
  '```python', 'config = """---', 'title: Frontmatterではない', '---"""', 'print("雪 ☃")  ', '```', '',
  '```typescript', 'const value: string = "hello";', '```', '',
  '```sql', 'SELECT id FROM applications WHERE status = \'applied\';', '```', '',
  '```bash', 'printf \'%s\\n\' "hello"', '```', '', '長い行' + 'abc'.repeat(100),
].join('\n');
const seedArticle = `---\ntitle: Metadata sample\npublishedAt: "2026-01-01"\nupdatedAt: "2026-01-02T09:30:00+09:00"\ncustom:\n  example.com: preserved\ncategory: Notes\nlanguage: en\ndraft: false\n---\n\n${body}\n`;

async function seed(page, files) {
  await page.evaluate(async files => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('sveltia-cms-test', { create: true });
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
    canvas.getContext('2d').fillRect(0, 0, 2, 2);
    const seeded = { 'public/images/sample.png': { base64: canvas.toDataURL('image/png').split(',')[1] }, ...files };
    for (const [path, content] of Object.entries(seeded)) {
      const segments = path.split('/');
      const name = segments.pop();
      let dir = root;
      for (const segment of segments) dir = await dir.getDirectoryHandle(segment, { create: true });
      const writer = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await writer.write(typeof content === 'string' ? content : Uint8Array.from(atob(content.base64), char => char.charCodeAt(0)));
      await writer.close();
    }
  }, files);
}
async function readRepo(page) {
  return page.evaluate(async () => {
    const files = {};
    async function walk(dir, prefix = '') {
      for await (const handle of dir.values()) {
        if (handle.kind === 'directory') await walk(handle, `${prefix}${handle.name}/`);
        else files[`${prefix}${handle.name}`] = await (await handle.getFile()).text();
      }
    }
    try { await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('sveltia-cms-test')); } catch {}
    return files;
  });
}
async function openTestCMS(page, files = {}) {
  // Only this browser context uses the official virtual repository. Production config is unchanged.
  await page.route('**/admin/config.yml*', route => route.fulfill({
    contentType: 'application/yaml',
    body: JSON.stringify({ ...config, backend: { name: 'test-repo' }, publish_mode: 'simple' }),
  }));
  await page.route('https://api.github.com/**', route => route.abort('blockedbyclient'));
  await page.goto('/admin/');
  await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
  await seed(page, files);
  await page.getByRole('button', { name: 'Work with Test Repository' }).click();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
}
async function openLocalCMS(page, files) {
  // Use the real GitHub configuration with the native local workflow, but the chosen
  // directory is OPFS, never this checkout or a real GitHub repository.
  await page.route('https://api.github.com/**', route => route.abort('blockedbyclient'));
  await page.goto('/admin/');
  await seed(page, files);
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('sveltia-cms-test');
    await root.getDirectoryHandle('.git', { create: true });
    window.showDirectoryPicker = async () => root;
  });
  await page.getByRole('button', { name: 'Work with Local Repository', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
}
const editor = page => page.getByRole('group', { name: 'Content Editor' });

for (const status of [401, 403]) {
  test(`GitHub login refuses ${status}; unauthenticated users cannot write`, async ({ page }) => {
    const requests = [];
    await page.route('https://api.github.com/**', async route => {
      requests.push(route.request().method());
      await route.fulfill({ status, json: { message: status === 401 ? 'Bad credentials' : 'Resource not accessible by personal access token' } });
    });
    await page.goto('/admin/');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Sign In Using Access Token' });
    await dialog.getByRole('textbox', { name: 'Personal Access Token' }).fill('invalid-test-token');
    await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(editor(page)).toHaveCount(0);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(method => method === 'GET')).toBe(true);
  });
}

test('existing articles round-trip with raw code, unknown metadata, dates and saved slug preserved', async ({ page }) => {
  await openTestCMS(page, {
    'src/content/writing/ai-backend-practicum.md': existing,
    'src/content/writing/metadata-sample.md': seedArticle,
  });
  await page.getByRole('row', { name: /^Metadata sample/ }).click();
  const form = editor(page);
  await expect(form.getByRole('textbox', { name: '本文', exact: true })).toHaveValue(body);
  await expect(page.getByRole('button', { name: 'Edit Slug' })).toHaveCount(0);
  await form.getByRole('textbox', { name: 'タイトル', exact: true }).fill('Metadata edited');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await readRepo(page))['src/content/writing/metadata-sample.md']).toContain('Metadata edited');
  const saved = parseFrontmatter((await readRepo(page))['src/content/writing/metadata-sample.md']);
  expect(saved.content.trim()).toBe(body);
  await mkdir('qa/cms-test-results/generated', { recursive: true });
  await writeFile('qa/cms-test-results/generated/cms-metadata.md', (await readRepo(page))['src/content/writing/metadata-sample.md']);
  expect(saved.frontmatter).toMatchObject({ publishedAt: '2026-01-01', updatedAt: '2026-01-02T09:30:00+09:00', custom: { 'example.com': 'preserved' }, language: 'en' });
  expect((await readRepo(page))['src/content/writing/ai-backend-practicum.md']).toBe(existing);
  await page.goto('/admin/');
  await page.getByRole('row', { name: /^AIにバックエンド/ }).click();
  await form.getByRole('textbox', { name: 'タイトル', exact: true }).fill('既存記事の編集確認');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await readRepo(page))['src/content/writing/ai-backend-practicum.md']).toContain('既存記事の編集確認');
  expect(parseFrontmatter((await readRepo(page))['src/content/writing/ai-backend-practicum.md']).content.trim()).toBe(parseFrontmatter(existing).content.trim());
});

test('creates a Japanese article with required manual slug and optional fields omitted', async ({ page }) => {
  await openTestCMS(page);
  await page.getByRole('button', { name: 'Create New Entry', exact: true }).first().click();
  const form = editor(page);
  await form.getByRole('textbox', { name: 'タイトル', exact: true }).fill('日本語の新規記事');
  await form.getByRole('textbox', { name: '本文', exact: true }).fill(body);
  const slugPanel = page.getByRole('group', { name: 'Slug', exact: true });
  const slug = slugPanel.getByRole('textbox', { name: 'Slug', exact: true });
  await expect(slug).toBeVisible();
  await slug.fill('cms-roundtrip');
  await slug.press('Enter');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await readRepo(page))['src/content/writing/cms-roundtrip.md']).toBeTruthy();
  const markdown = (await readRepo(page))['src/content/writing/cms-roundtrip.md'];
  const saved = parseFrontmatter(markdown);
  expect(saved.frontmatter).toEqual({ title: '日本語の新規記事', language: 'ja', draft: false });
  expect(saved.content.trim()).toBe(body);
  await mkdir('qa/cms-test-results/generated', { recursive: true });
  await writeFile('qa/cms-test-results/generated/cms-roundtrip.md', markdown);
});

test('preview removes executable HTML and renders representative Markdown', async ({ page }) => {
  const unsafe = body + '\n\n<script>window.__cmsXss = true</script>\n<img src="x" onerror="window.__cmsXss = true">\n[unsafe](javascript:alert(1))';
  await openTestCMS(page, { 'src/content/writing/preview.md': seedArticle.replace(body, unsafe) });
  await page.getByRole('row', { name: /^Metadata sample/ }).click();
  const preview = editor(page).getByRole('document', { name: 'Content Preview' });
  await expect(preview.getByRole('heading', { name: '日本語と English ☃' })).toBeVisible();
  await expect(preview.locator('table')).toHaveCount(1);
  await expect(preview.locator('pre')).toHaveCount(4);
  await expect.poll(() => preview.getByRole('img', { name: '画像', exact: true }).evaluate(image => image.naturalWidth)).toBe(2);
  expect(await preview.locator('script, [onerror], a[href^="javascript:"]').count()).toBe(0);
  expect(await page.evaluate(() => window.__cmsXss)).toBeUndefined();
});

test('browser backup restores unsent work without changing repository files', async ({ page }) => {
  await openLocalCMS(page, { 'src/content/writing/metadata-sample.md': seedArticle });
  await page.getByRole('row', { name: /^Metadata sample/ }).click();
  const form = editor(page);
  const input = form.getByRole('textbox', { name: '本文', exact: true });
  await input.click();
  await input.fill('ブラウザだけに残す編集中の文章');
  await expect.poll(() => page.evaluate(async () => {
    let count = 0;
    for (const { name } of await indexedDB.databases()) {
      const database = await new Promise(resolve => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); });
      if (database.objectStoreNames.contains('draft-backups')) {
        count += await new Promise(resolve => { const request = database.transaction('draft-backups').objectStore('draft-backups').count(); request.onsuccess = () => resolve(request.result); });
      }
      database.close();
    }
    return count;
  })).toBeGreaterThan(0);
  expect((await readRepo(page))['src/content/writing/metadata-sample.md']).toBe(seedArticle);
  await form.getByRole('button', { name: 'Cancel Editing' }).click();
  await page.getByRole('row', { name: /^Metadata sample/ }).click();
  const restore = page.getByRole('alertdialog', { name: 'Restore Draft' });
  await expect(restore).toBeVisible();
  await restore.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(input).toHaveValue('ブラウザだけに残す編集中の文章');
  await mkdir('qa/screenshots/cms', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `qa/screenshots/cms/editor-${width}.png`, fullPage: true });
  }
});

test('failed virtual-repository save keeps the original file and edited text; retry succeeds', async ({ page }) => {
  await openTestCMS(page, { 'src/content/writing/metadata-sample.md': seedArticle });
  await page.getByRole('row', { name: /^Metadata sample/ }).click();
  const form = editor(page);
  const input = form.getByRole('textbox', { name: '本文', exact: true });
  await input.fill('保存失敗しても残る文章');
  await page.evaluate(() => {
    window.__originalWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async () => { throw new DOMException('Simulated storage failure', 'NotAllowedError'); };
  });
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  const error = page.getByRole('alertdialog', { name: 'Error' });
  await expect(error).toContainText('There was an error while saving the entry');
  expect((await readRepo(page))['src/content/writing/metadata-sample.md']).toBe(seedArticle);
  await error.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(input).toHaveValue('保存失敗しても残る文章');
  await page.evaluate(() => { FileSystemFileHandle.prototype.createWritable = window.__originalWritable; });
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await readRepo(page))['src/content/writing/metadata-sample.md']).toContain('保存失敗しても残る文章');
});

test('uploads PNG/JPEG/WebP with unique names and rejects an image over 2 MiB', async ({ page }) => {
  await openTestCMS(page);
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
    const context = canvas.getContext('2d');
    return ['image/png', 'image/png', 'image/jpeg', 'image/webp'].map((type, index) => {
      context.fillStyle = ['red', 'blue', 'green', 'orange'][index]; context.fillRect(0, 0, 2, 2);
      return { type, base64: canvas.toDataURL(type).split(',')[1] };
    });
  });
  await mkdir('qa/cms-test-results/generated', { recursive: true });
  await writeFile('qa/cms-test-results/generated/cms-image.png', Buffer.from(images[0].base64, 'base64'));
  await page.getByRole('radio', { name: 'Assets', exact: true }).click();
  const upload = async files => {
    await page.getByRole('button', { name: 'Upload New Assets', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Upload New Assets', exact: true });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dialog.getByRole('button', { name: 'Choose Files', exact: true }).click()]);
    await chooser.setFiles(files);
    return page.getByRole('alertdialog', { name: 'Upload New Assets', exact: true });
  };
  for (const [index, image] of images.entries()) {
    const extension = image.type.split('/')[1];
    const dialog = await upload([{ name: `photo.${extension}`, mimeType: image.type, buffer: Buffer.from(image.base64, 'base64') }]);
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect.poll(async () => Object.keys(await readRepo(page)).filter(path => path.startsWith('public/images/photo-')).length).toBe(index + 1);
  }
  const files = Object.keys(await readRepo(page));
  expect(files.filter(path => /^public\/images\/photo-[a-z0-9-]+\.png$/.test(path))).toHaveLength(2);
  expect(files.some(path => path.endsWith('.jpeg'))).toBe(true);
  expect(files.some(path => path.endsWith('.webp'))).toBe(true);
  const dialog = await upload([{ name: 'large.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from(images[0].base64, 'base64'), Buffer.alloc(2 * 1024 * 1024)]) }]);
  await expect(dialog.getByRole('alert')).toContainText('exceeds the maximum size');
  await expect(dialog.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled();
  expect(Object.keys(await readRepo(page))).toHaveLength(5);
});

test('deleting a virtual entry requires confirmation and leaves other content intact', async ({ page }) => {
  await openTestCMS(page, {
    'src/content/writing/metadata-sample.md': seedArticle,
    'src/content/writing/ai-backend-practicum.md': existing,
  });
  await page.getByRole('row', { name: /^Metadata sample/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete Entry', exact: true });
  await expect(dialog).toBeVisible();
  expect((await readRepo(page))['src/content/writing/metadata-sample.md']).toBe(seedArticle);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(async () => (await readRepo(page))['src/content/writing/metadata-sample.md']).toBeUndefined();
  expect((await readRepo(page))['src/content/writing/ai-backend-practicum.md']).toBe(existing);
});
