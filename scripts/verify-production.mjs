import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

if (process.env.NOTES_QA === '1') throw new Error('本番ビルドでは NOTES_QA を設定しないでください。');
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.name.startsWith('.env') || /\.(pem|key)$/.test(entry.name)) throw new Error(`Private file: ${file}`);
    if (entry.isDirectory()) await verify(file);
    else if (/\.(html|json|js|txt|xml)$/.test(entry.name)) {
      const body = await readFile(file, 'utf8');
      if (/NOTES_QA_FIXTURE|DRAFT_MUST_NEVER_APPEAR|DRAFT_SECRET_BODY_MUST_NEVER_APPEAR/.test(body)) {
        throw new Error(`検証原稿・下書きが本番成果物に混入しています: ${file}`);
      }
      if (/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/.test(body)) {
        throw new Error(`Potential credential: ${file}`);
      }
    }
  }
}
await verify('dist');
console.log('Production verified: no test specimens, draft sentinels, environment files, or credential patterns.');
