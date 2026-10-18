import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Retain the original, unmodified font subsets needed by the current writing and UI. */
export function japaneseFontSubsets(qa = false) {
  const characters = new Set();
  /** @param {string} directory @param {RegExp} extension */
  function collect(directory, extension) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file, extension);
      else if (extension.test(entry.name)) for (const character of readFileSync(file, 'utf8')) characters.add(character.codePointAt(0));
    }
  }
  collect('src', /\.astro$/);
  collect(qa ? 'tests/fixtures' : 'src/content/writing', /\.md$/);
  const points = [...characters];
  return {
    name: 'notes-japanese-font-subsets',
    apply: /** @type {const} */ ('build'),
    enforce: /** @type {const} */ ('pre'),
    /** @param {string} source @param {string} id */
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('@fontsource/shippori-mincho/400.css')) return;
      const code = source.replace(/@font-face\s*\{[^}]+\}/g, rule => {
        const ranges = /unicode-range:\s*([^;]+);/.exec(rule)?.[1];
        if (!ranges) return rule;
        const needed = ranges.split(',').some(range => {
          const [start, end = start] = range.trim().replace(/^U\+/i, '').split('-').map(value => parseInt(value, 16));
          return points.some(point => point >= start && point <= end);
        });
        return needed ? rule.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '') : '';
      });
      return { code, map: null };
    },
  };
}
