import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const directory = await mkdtemp('src/content/writing/authoring-check-');
function build(expected = 0) {
  const result = spawnSync('npm', ['run', 'build'], { encoding: 'utf8', env: { ...process.env, CI: '1', ASTRO_TELEMETRY_DISABLED: '1' } });
  if (expected === 0 && result.status !== 0) throw new Error(result.stdout + result.stderr);
  if (expected !== 0 && result.status === 0) throw new Error('Invalid metadata unexpectedly built.');
}
async function htmlContents(directory) {
  let contents = '';
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) contents += await htmlContents(file);
    else if (file.endsWith('.html')) contents += await readFile(file, 'utf8');
  }
  return contents;
}
try {
  await writeFile(path.join(directory, 'published.md'), '---\ntitle: "AUTHORING_PUBLIC_TEST"\npublishedAt: "2026-10-18"\nlanguage: ja\ndraft: false\n---\n\nAUTHORING_PUBLIC_BODY\n');
  await writeFile(path.join(directory, 'draft.md'), '---\ntitle: "AUTHORING_DRAFT_TEST"\npublishedAt: "2026-10-19"\ndraft: true\n---\n\nAUTHORING_PRIVATE_BODY\n');
  build();
  assert.match(await readFile('dist/index.html', 'utf8'), /AUTHORING_PUBLIC_TEST/);
  assert.match(await readFile('dist/writing/index.html', 'utf8'), /AUTHORING_PUBLIC_TEST/);
  const html = await htmlContents('dist');
  assert.match(html, /AUTHORING_PUBLIC_BODY/);
  assert.doesNotMatch(html, /AUTHORING_DRAFT_TEST|AUTHORING_PRIVATE_BODY/);
  console.log('PASS: adding Markdown creates Home, Writing and article output; draft title/body generate no HTML.');
  await writeFile(path.join(directory, 'invalid.md'), '---\ntitle: "INVALID_METADATA_TEST"\npublishedAt: "2026-02-30"\n---\n');
  build(1);
  console.log('PASS: invalid calendar date is rejected by the content collection schema.');
  await writeFile(path.join(directory, 'invalid.md'), '---\ntitle: "INVALID_METADATA_TEST"\npublishedAt: "2026-10-18"\nupdatedAt: "2026-10-17"\n---\n');
  build(1);
  console.log('PASS: updatedAt before publishedAt is rejected by the content collection schema.');
} finally {
  await rm(directory, { recursive: true, force: true });
  build();
}
assert.doesNotMatch(await htmlContents('dist'), /AUTHORING_PUBLIC_TEST|AUTHORING_PUBLIC_BODY|AUTHORING_DRAFT_TEST|AUTHORING_PRIVATE_BODY/);
console.log('PASS: temporary writing removed and clean production output rebuilt.');
