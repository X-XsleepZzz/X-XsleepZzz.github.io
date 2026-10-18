import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFrontmatter } from 'astro/markdown';

const config = parseFrontmatter(`---\n${readFileSync('public/admin/config.yml', 'utf8')}\n---`).frontmatter;

test('CMS saves to preview PRs in the existing repository and locks saved URLs', () => {
  assert.deepEqual(config.backend, {
    name: 'github', repo: 'X-XsleepZzz/X-XsleepZzz.github.io', branch: 'main', squash_merges: true,
  });
  assert.deepEqual(config.publish_mode, { type: 'preview', direct_publish: false, allow_incomplete_drafts: false });
  const [writing] = config.collections;
  assert.equal(config.collections.length, 1);
  assert.equal(writing.folder, 'src/content/writing');
  assert.equal(writing.format, 'yaml-frontmatter');
  assert.equal(writing.extension, 'md');
  assert.deepEqual(writing.slug.editable, ['create']);
  assert.equal(writing.slug.template, undefined, 'New slugs must be typed rather than generated from Japanese titles');
  const slug = new RegExp(writing.slug.pattern[0]);
  for (const value of ['hello', 'backend-2026']) assert.ok(slug.test(value));
  for (const value of ['', '../admin', '日本語', 'hello world', '-hello', 'hello--world']) assert.ok(!slug.test(value));
  assert.equal(writing.preview_path, 'writing/{{slug}}/');
});

test('CMS output respects optional Zod fields, automatic dates and sanitized raw Markdown', () => {
  const fields = Object.fromEntries(config.collections[0].fields.map(field => [field.name, field]));
  assert.deepEqual(Object.keys(fields), ['title', 'description', 'category', 'language', 'draft', 'body']);
  assert.deepEqual(fields.category.options, ['Learning', 'Essays', 'Notes']);
  assert.deepEqual(fields.language.options, ['ja', 'en']);
  assert.equal(fields.language.default, 'ja');
  assert.equal(fields.category.required, false);
  assert.equal(fields.description.required, false);
  assert.equal(config.output.omit_empty_optional_fields, true);
  assert.equal(config.output.yaml.quote, 'double', 'Manual ISO date strings must remain quoted for Astro');
  assert.equal(fields.draft.default, false, 'Preview PRs, not a second publication switch, protect new entries');
  assert.deepEqual(fields.body.modes, ['raw']);
  assert.equal(fields.body.sanitize_preview, true);
  assert.equal(config.media_folder, 'public/images');
  assert.equal(config.public_folder, '/images');
  assert.equal(config.media_libraries.default.config.max_file_size, 2 * 1024 * 1024);
  assert.match(config.media_libraries.default.config.filename_template, /\{\{uuid_short\}\}/);
  assert.equal(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/.test(JSON.stringify(config)), false);
});

test('CMS script is isolated, pinned with SRI, noindex and a policy without inline scripts', () => {
  const html = readFileSync('public/admin/index.html', 'utf8');
  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(html, /https:\/\/unpkg\.com\/@sveltia\/cms@0\.248\.0\/dist\/sveltia-cms\.js/);
  assert.match(html, /integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"/);
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const scriptPolicy = policy.split(';').find(directive => directive.trim().startsWith('script-src '));
  assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);
  assert.match(policy, /object-src 'none'/);
  for (const file of ['src/layouts/Base.astro', 'src/pages/index.astro', 'src/pages/writing/[...id].astro']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /sveltia-cms|\/admin\/config/);
  }
});
