import test from 'node:test';
import assert from 'node:assert/strict';
import { japaneseFontSubsets } from '../scripts/font-subsets.mjs';

test('the shipped Japanese font CSS covers every character present in writing and interface', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const id = '/node_modules/@fontsource/shippori-mincho/400.css';
  const source = readFileSync(`node_modules/@fontsource/shippori-mincho/400.css`, 'utf8');
  const selected = japaneseFontSubsets(true).transform(source, id).code;
  const rangesFor = css => [...css.matchAll(/unicode-range:\s*([^;]+);/g)].flatMap(match => match[1].split(',').map(range => {
    const [start, end = start] = range.trim().replace(/^U\+/i, '').split('-').map(value => parseInt(value, 16));
    return [start, end];
  }));
  const allRanges = rangesFor(source), selectedRanges = rangesFor(selected);
  const present = new Set();
  function scan(directory, extension) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(file, extension);
      else if (extension.test(entry.name)) for (const character of readFileSync(file, 'utf8')) present.add(character);
    }
  }
  scan('src', /\.astro$/); scan('tests/fixtures', /\.md$/);
  for (const character of present) {
    const point = character.codePointAt(0);
    const covered = ranges => ranges.some(([start, end]) => point >= start && point <= end);
    if (covered(allRanges)) assert.ok(covered(selectedRanges), `Missing ${character} (U+${point.toString(16)})`);
  }
  assert.ok(selected.length < source.length * 0.5, 'unused subset definitions are removed');
  assert.equal(japaneseFontSubsets(true).transform('unchanged', '/src/styles/global.css'), undefined);
});
