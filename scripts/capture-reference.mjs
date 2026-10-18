import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('qa/screenshots/reference', { recursive: true });
const browser = await chromium.launch();
const measurements = [];
for (const width of [1440, 375]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  for (const [name, url] of [['home', 'https://thinkingmachines.ai/'], ['writing', 'https://thinkingmachines.ai/blog/'], ['article', 'https://thinkingmachines.ai/blog/lora/']]) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `qa/screenshots/reference/${name}-${width}.png` });
    measurements.push({ width, name, url, elements: await page.locator('main,h1,main p,main h2,nav').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().width > 0).slice(0,8).map(el => {
      const s = getComputedStyle(el), rect = el.getBoundingClientRect();
      return { tag: el.tagName, width: rect.width, x: rect.x, y: rect.y, font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, margin: s.margin, padding: s.padding, color: s.color };
    })) });
  }
  await page.close();
}
await writeFile('qa/reference-measurements.json', JSON.stringify(measurements, null, 2));
await browser.close();
console.log('Reference measurements and screenshots saved.');
