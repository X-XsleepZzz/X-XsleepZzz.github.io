import { defineConfig } from 'astro/config';
import { japaneseFontSubsets } from './scripts/font-subsets.mjs';

export default defineConfig({
  site: 'https://x-xsleepzzz.github.io',
  output: 'static',
  trailingSlash: 'always',
  outDir: process.env.NOTES_QA === '1' ? './.qa-dist' : './dist',
  cacheDir: process.env.NOTES_QA === '1' ? './.qa-astro' : './.astro',
  devToolbar: { enabled: false },
  vite: { plugins: [japaneseFontSubsets(process.env.NOTES_QA === '1')] },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
      wrap: false,
      transformers: [{
        name: 'keyboard-accessible-code',
        pre(node) { node.properties.tabIndex = 0; node.properties.ariaLabel = 'Code block'; },
      }],
    },
  },
});
