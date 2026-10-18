import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.NOTES_AUDIT_URL ?? 'http://127.0.0.1:4321';
const routes = process.env.NOTES_AUDIT_PRODUCTION === '1'
  ? [['home', '/'], ['writing', '/writing/']]
  : [['home', '/'], ['writing', '/writing/'], ['article-ja', '/writing/ja-typography/'], ['article-en', '/writing/en-typography/'], ['article-code', '/writing/technical/']];
await mkdir('qa/lighthouse', { recursive: true });
const summaries = [];
for (const [name, route] of routes) {
  // Fresh profile per run; no reuse of the user's everyday browser.
  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless', '--no-first-run', '--disable-extensions'] });
  try {
    const result = await lighthouse(new URL(route, base).href, {
      port: chrome.port, output: ['json', 'html'], logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    await writeFile(`qa/lighthouse/${name}.json`, result.report[0]);
    await writeFile(`qa/lighthouse/${name}.html`, result.report[1]);
    const { lhr } = result;
    const summary = {
      page: name, url: lhr.finalDisplayedUrl, date: lhr.fetchTime,
      lighthouseVersion: lhr.lighthouseVersion,
      scores: Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)])),
      metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'total-byte-weight'].map(key => [key, lhr.audits[key]?.numericValue])),
      failingAudits: Object.entries(lhr.audits).filter(([, audit]) => audit.score !== null && audit.score < 1 && ['numeric', 'binary'].includes(audit.scoreDisplayMode)).map(([id, audit]) => ({ id, title: audit.title, displayValue: audit.displayValue })),
      warnings: lhr.runWarnings,
    };
    summaries.push(summary);
    console.log(JSON.stringify(summary));
  } finally { await Promise.resolve(chrome.kill()); }
}
await writeFile('qa/lighthouse-summary.json', JSON.stringify(summaries, null, 2));
