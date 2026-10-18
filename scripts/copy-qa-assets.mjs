import { copyFile } from 'node:fs/promises';
await copyFile('tests/fixtures/specimen.svg', '.qa-dist/qa-specimen.svg');
